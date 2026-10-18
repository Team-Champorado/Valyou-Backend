#!/usr/bin/env bash
set -e

# ==============================================================================
# Google Cloud Run Deployment Script for Valyou Server
# ==============================================================================

# Configurations (can be overridden via environment variables)
PROJECT_ID="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-asia-southeast1}"
SERVICE_NAME="${GCP_SERVICE_NAME:-valyou-server}"
REPO_NAME="${GCP_REPO_NAME:-valyou-repo}"
BUCKET_NAME="${GCP_UPLOADS_BUCKET:-valyou-uploads-${PROJECT_ID}}"

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: GCP_PROJECT_ID is not set."
    echo "Usage: GCP_PROJECT_ID=your-project-id [GCP_REGION=region] ./deploy-gcp.sh"
    exit 1
fi

echo "🚀 Starting deployment for Valyou Server to Google Cloud..."
echo "Project ID : $PROJECT_ID"
echo "Region     : $REGION"
echo "Service    : $SERVICE_NAME"
echo ""

# 1. Enable Required Google Cloud APIs
echo "📦 [1/6] Enabling Google Cloud Services..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    storage.googleapis.com \
    --project="$PROJECT_ID"

# 2. Ensure Artifact Registry repository exists
echo "📦 [2/6] Checking Artifact Registry repository..."
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
    echo "Creating Artifact Registry repository '$REPO_NAME' in '$REGION'..."
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --project="$PROJECT_ID" \
        --description="Docker repository for Valyou services"
else
    echo "Repository '$REPO_NAME' already exists."
fi

# 3. Ensure Cloud Storage bucket exists for persistent uploads
echo "🪣 [3/6] Checking Cloud Storage bucket for /uploads..."
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" --project="$PROJECT_ID" &>/dev/null; then
    echo "Creating Cloud Storage bucket 'gs://${BUCKET_NAME}'..."
    gcloud storage buckets create "gs://${BUCKET_NAME}" \
        --project="$PROJECT_ID" \
        --location="$REGION"
else
    echo "Bucket 'gs://${BUCKET_NAME}' already exists."
fi

# 4. Build and Push container image using Cloud Build
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"
echo "🔨 [4/6] Building and pushing Docker container to Artifact Registry ($IMAGE_URI)..."
cd "$(dirname "$0")"
gcloud builds submit --tag "$IMAGE_URI" --project="$PROJECT_ID" .

# 5. Load environment variables from .env if present
DATABASE_URL_VAL="${DATABASE_URL:-}"
JWT_SECRET_VAL="${JWT_SECRET:-}"
GEMINI_API_KEY_VAL="${GEMINI_API_KEY:-}"
GEMINI_MODEL_VAL="${GEMINI_MODEL:-gemini-3.5-flash-lite}"

if [ -f ".env" ]; then
    echo "Reading environment defaults from .env..."
    [ -z "$DATABASE_URL_VAL" ] && DATABASE_URL_VAL=$(grep '^DATABASE_URL=' .env | cut -d '=' -f2- | tr -d '"' || true)
    [ -z "$JWT_SECRET_VAL" ] && JWT_SECRET_VAL=$(grep '^JWT_SECRET=' .env | cut -d '=' -f2- | tr -d '"' || true)
    [ -z "$GEMINI_API_KEY_VAL" ] && GEMINI_API_KEY_VAL=$(grep '^GEMINI_API_KEY=' .env | cut -d '=' -f2- | tr -d '"' || true)
    [ -z "$GEMINI_MODEL_VAL" ] && GEMINI_MODEL_VAL=$(grep '^GEMINI_MODEL=' .env | cut -d '=' -f2- | tr -d '"' || true)
fi

CLOUDSQL_INSTANCE="${GCP_CLOUDSQL_INSTANCE:-${PROJECT_ID}:${REGION}:valyou-db}"
CLOUDSQL_DB_URL="postgresql://valyou_user:b63900a92eb0c163593f2255f630ac72@localhost/valyou?host=/cloudsql/${CLOUDSQL_INSTANCE}"

# If DATABASE_URL is pointing to localhost:5432 or unset, use Cloud SQL socket URL
if [ -z "$DATABASE_URL_VAL" ] || echo "$DATABASE_URL_VAL" | grep -q "localhost:5432"; then
    DATABASE_URL_VAL="$CLOUDSQL_DB_URL"
fi

ENV_VARS_FLAG="JWT_SECRET=${JWT_SECRET_VAL},GEMINI_API_KEY=${GEMINI_API_KEY_VAL},GEMINI_MODEL=${GEMINI_MODEL_VAL},DATABASE_URL=${DATABASE_URL_VAL}"

# 6. Deploy to Google Cloud Run with GCS volume mount for persistent uploads and Cloud SQL instance
echo "🚀 [5/6] Deploying to Google Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image="$IMAGE_URI" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --platform=managed \
    --allow-unauthenticated \
    --memory=1Gi \
    --cpu=1 \
    --set-env-vars="$ENV_VARS_FLAG" \
    --add-cloudsql-instances="$CLOUDSQL_INSTANCE" \
    --add-volume=name=uploads-volume,type=cloud-storage,bucket="$BUCKET_NAME" \
    --add-volume-mount=volume=uploads-volume,mount-path=/app/uploads

echo ""
echo "🎉 [6/6] Deployment successful!"
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)")
echo "🌐 Service URL: $SERVICE_URL"
echo "📄 Swagger API: ${SERVICE_URL}/api-docs"

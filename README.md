# Valyou Backend — Automated Real Estate Valuation API

Valyou Backend is the core valuation and geospatial intelligence service powering the **Valyou** real estate platform ("Fairness in Every Square Meter"). It provides automated appraisals, Project NOAH environmental hazard analysis, OpenStreetMap geospatial queries, and multi-modal computer vision assessments.

---

## 🏗️ Architecture & Features

- **⚡ Core API**: Node.js & Express.js with TypeScript and structured routing.
- **🗺️ Project NOAH Hazard Service**:
  - Direct integration with DOST-PAGASA Project NOAH hazard models.
  - Generates and serves raster map tiles for **5-Year Flood**, **Landslide Susceptibility**, and **Storm Surge** risks.
  - Dynamic hazard assessment by coordinate bounding boxes and pin-drops.
- **🤖 Valyou AI Valuation Engine**:
  - Multi-stage conservative appraisal algorithm.
  - Computer vision inspection of uploaded property photos (facade, foundation, finish wear).
  - Actuarial depreciation curves, material multipliers, and environmental risk adjustments.
  - Cross-references Bureau of Internal Revenue (BIR) zonal values and regional comps.
- **📍 Geospatial & POI Ingestion**: OpenStreetMap reverse geocoding to resolve street, barangay, city, and province, with automatic nearby amenity discovery.
- **🔒 Authentication & Security**: JWT-based authentication with bcrypt password hashing and protected API routes.
- **🗄️ Database**: PostgreSQL with Prisma ORM.
- **☁️ Cloud-Native & Containerized**: Dockerfile configured for deployment to Google Cloud Run and Google Cloud SQL.

---

## 🚀 API Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT bearer token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `GET` | `/api/listing` | List recent property valuations |
| `POST` | `/api/listing/new` | Create a new property valuation draft with photos |
| `POST` | `/api/listing/:id/process` | Trigger multi-stage AI appraisal pipeline |
| `GET` | `/api/listing/:id` | Poll valuation progress and fetch final appraisal report |
| `POST` | `/api/noah/check` | Query DOST-NOAH risk levels for given coordinates |
| `GET` | `/tiles/:layer/:z/:x/:y.png` | Serve Project NOAH hazard raster map tiles |
| `GET` | `/api/docs` | Interactive Swagger API documentation |

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Node.js**: v18 or higher
- **PostgreSQL**: v14+ (Local instance or Cloud SQL)
- **Gemini API Key**: For AI appraisal & structural image analysis

### 2. Environment Setup
Copy the example environment file and configure your credentials:
```bash
cp .env.example .env
```

Configure the following variables in `.env`:
```env
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/valyou?schema=public"
JWT_SECRET="your_secure_jwt_secret"
GEMINI_API_KEY="your_gemini_api_key"
GEMINI_MODEL="gemini-2.5-flash"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup & Migrations
```bash
npx prisma generate
npx prisma db push
```

### 5. Running the Server

#### Development Mode (with hot-reload):
```bash
npm run dev
```

#### Production Build & Run:
```bash
npm run build
npm start
```

---

## 🐳 Docker & Cloud Deployment

### Build Local Docker Image:
```bash
docker build -t valyou-backend .
docker run -p 3000:3000 --env-file .env valyou-backend
```

### Deploy to Google Cloud Run:
```bash
./deploy-gcp.sh
```

---

## 📄 License
© 2026 Valyou. All rights reserved.

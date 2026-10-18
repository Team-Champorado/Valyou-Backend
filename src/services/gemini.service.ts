import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// Helper to encode image
function fileToGenerativePart(path: string, mimeType: string) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType
        },
    };
}

export const analyzeImage = async (filePath: string): Promise<any> => {
    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`[Gemini Vision] Image file not found on disk: ${filePath}`);
            return { area: "Facade", condition: "Good", defects: [], features: ["Clean exterior structural layout"] };
        }

        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const imagePart = fileToGenerativePart(filePath, "image/jpeg"); // Assuming JPEG/PNG

        const prompt = `
        Analyze this property image acting as a professional real estate appraiser.
        Identify the room or area (e.g., Kitchen, Facade, Living Room).
        Assess the condition (Poor, Fair, Good, Excellent).
        List visible materials (e.g., hardwood floor, granite counter).
        List any defects (e.g., cracks, water stains, peeling paint).
        List premium features (e.g., modern lighting, high ceiling).
        
        Return STRICT JSON format only:
        {
            "area": "string",
            "condition": "string",
            "materials": ["string"],
            "defects": ["string"],
            "features": ["string"]
        }
        `;

        console.log(`🚀 [Gemini Request] Analyzing image: ${path.basename(filePath)} with model: ${GEMINI_MODEL}`);
        console.log(`📝 [Gemini Prompt - Image Analysis]:`, prompt);
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Clean markdown
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);
        console.log(`📦 [Gemini Response] Image Analysis:`, JSON.stringify(data, null, 2));

        return { ...data, usageMetadata: response.usageMetadata };

    } catch (error) {
        console.error("Gemini Vision Error:", error);
        return { area: "Unknown", condition: "Unknown", defects: [], features: [] };
    }
};

export const generateFinalValuation = async (contextData: any): Promise<any> => {
    try {
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
        Act as a strictly conservative professional real estate appraiser and dealer (Buy-and-Sell logic) in the Philippines (Cebu specific).
        Your goal is to calculate a safe "Dealer's Buying Price" or conservative Market Value, not an optimistic seller's price.

        CONTEXT DATA:
        ${JSON.stringify(contextData, null, 2)}

        VALUATION LOGIC (Dealer Mindset):
        1. **Base Value Anchor (STRICT)**: 
           - **ALWAYS START with the provided \`askingPrice\` as your \`baseValue\`**. 
           - Do NOT calculate a hypothetical "Market Value" based on lot size multiplied by average price/sqm. We are evaluating *this specific deal*.
           - If the \`askingPrice\` is 1,500,000, your \`baseValue\` MUST BE 1,500,000. 
           - We work DOWN from the asking price (Deductions) or slightly UP (Premiums). We never start 3x higher.
        
        2. **Structural Deductions (Aggressive)**: 
           - You are a DEALER. You hate repairs. 
           - For every defect found in \`imageFindings\` (e.g., cracks, peeling paint, stains), imply a HIGH cost of repair. 
           - Multiply standard repair estimates by 1.5x to account for "hassle factor". 
           - Deductions should be substantial (e.g., -50k to -200k for visible issues).

        3. **Feature Premiums (Conservative)**:
           - You are a DEALER. You don't pay extra for "potential".
           - Only give premiums for TANGIBLE, HIGH-VALUE assets (e.g., modern renovations, proximity to Ayalas/IT Park).
           - Ignore "nice curtains" or "good lighting".
           - Cap premiums at max 10% of base value unless it's a prime location.

        4. **Risk Assessment (AI-Driven)**:
           - Analyze the \`address\`, \`latitude\`, and \`longitude\`.
           - DETERMINE the risk level for **Flood**, **Landslide**, and **Storm Surge** based on your knowledge of Cebu geography.
           - Assign a \`riskScore\` (0-100) and \`riskLevel\` (LOW, MEDIUM, HIGH).
           - For EACH specific risk (Flood, Landslide, Storm Surge), assign a numeric \`level\` (0-100).
           - For EACH specific risk (Flood, Landslide, Storm Surge) with a level > 0, you **MUST** assign a **NEGATIVE COST** in \`structuralInsights\`. 
           - **NEVER** assign 0 cost for a detected risk.
             - Example LOW Risk: Cost -20,000
             - Example MEDIUM Risk: Cost -100,000
             - Example HIGH Risk: Cost -300,000 or more.
           - Example Item: { "type": "negative", "title": "High Flood Risk (Mambaling)", "cost": -300000, "description": "Located in severe flood zone..." }

        5. **Final Calculation**:
           - Final = Base - Deductions + Premiums - RiskPenalty.
           - **Sanity Check**: If the property has many defects and high risk, the \`Final\` value should typically be LOWER than the \`askingPrice\`.
           - **IMPORTANT**: In the \`valuationBreakdown\` JSON, return \`structuralDeductions\` and \`riskAdjustmentValue\` as **POSITIVE NUMBERS** (absolute values). Do not include a negative sign. The UI handles the subtraction.

        OUTPUT FORMAT:
        Return a single JSON object. Do not include markdown code blocks.
        {
            "estimatedValue": number,
            "finalValuation": number,
            "riskLevel": "LOW" | "MEDIUM" | "HIGH",
            "riskScore": number,
            "riskDetails": {
                "flood": { "level": number, "description": "string" },
                "landslide": { "level": number, "description": "string" },
                "stormSurge": { "level": number, "description": "string" }
            },
            "structuralInsights": {
                "confidence": number,
                "reason": "string",
                "insights": [
                    { "type": "positive" | "negative", "title": "string", "description": "string", "cost": number }
                ]
            },
            "valuationBreakdown": {
                "baseValue": number,
                "structuralDeductions": number,
                "featurePremiums": number,
                "adjustedValue": number,
                "riskAdjustmentValue": number,
                "riskPenaltyRate": number,
                "updatedValue": number
            },
            "aiAnalysis": {
                "details": "string",
                "factor": number
            }
        }
        `;

        console.log(`🚀[Gemini Request] Final Valuation`);
        console.log(`📝 [Gemini Prompt - Final Valuation]:`, prompt);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Robust JSON Extraction
        let jsonStr = text.trim();
        // Remove markdown blocks if present
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '');
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '');
        }

        // Use Regex to find the first { and last } to handle chatty prefixes/suffixes
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        try {
            const data = JSON.parse(jsonStr);
            console.log(`📦 [Gemini Response] Final Valuation:`, JSON.stringify(data, null, 2));
            return { ...data, usageMetadata: response.usageMetadata };
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError, "Raw Text:", text);
            throw new Error("Failed to parse Gemini JSON response");
        }

    } catch (error) {
        console.error("Gemini Pro Error:", error);
        return null; // Controller handles null as failure
    }
};

// Deprecated stub (keeping for compatibility if needed temporarily)
export const analyzeImages = async (imageUrls: string[]): Promise<any> => {
    return { condition: "Stub", factor: 1.0, details: "Legacy stub called." };
};

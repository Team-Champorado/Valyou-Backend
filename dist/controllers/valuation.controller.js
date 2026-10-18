"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const noah_service_1 = require("../services/noah.service");
const gemini_service_1 = require("../services/gemini.service");
const processValuation = async (req, res) => {
    try {
        const { id } = req.params;
        const listingId = id;
        const listing = await index_1.prisma.listing.findUnique({
            where: { id: listingId },
            include: { images: true },
        });
        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }
        // 1. Check Project NOAH Data
        const riskLevel = await (0, noah_service_1.checkFloodRisk)(listing.latitude, listing.longitude);
        // 2. AI Analysis (Stubbed)
        const imageUrls = listing.images.map((img) => img.url);
        const aiResult = await (0, gemini_service_1.analyzeImages)(imageUrls);
        // 3. Calculate Valuation
        // Base Calculation: Price * AI Factor
        // Risk Adjustment: High Risk -> -20%, Medium -> -10%
        let estimatedValue = listing.price * aiResult.factor;
        if (riskLevel === 'HIGH') {
            estimatedValue *= 0.8;
        }
        else if (riskLevel === 'MEDIUM') {
            estimatedValue *= 0.9;
        }
        const valuation = await index_1.prisma.valuation.create({
            data: {
                listingId,
                estimatedValue,
                riskLevel,
                aiAnalysis: JSON.stringify(aiResult),
            },
        });
        res.json(valuation);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.default = { processValuation };

import { Request, Response } from 'express';
import { prisma } from '../index';
import { checkFloodRisk, checkLandslideRisk, checkStormSurgeRisk } from '../services/noah.service';
import { getNearbyHotspots } from '../services/osm.service';
import { analyzeImage, generateFinalValuation } from '../services/gemini.service';
import path from 'path';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
    user?: {
        userId: string;
    };
}

const processValuation = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const listingId = id as string;

        const listing = await prisma.listing.findUnique({
            where: { id: listingId },
            include: { images: true, valuations: true },
        });

        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        if (listing.valuationStatus === 'PROCESSING' || listing.valuationStatus === 'STAGE1' || listing.valuationStatus === 'STAGE2' || listing.valuationStatus === 'STAGE3') {
            return res.status(202).json({ message: 'Valuation in progress', status: listing.valuationStatus });
        }

        if (listing.valuationStatus === 'COMPLETED' && listing.valuations.length > 0) {
            return res.json(listing.valuations[0]);
        }

        // Start processing (Async)
        // Update status first
        await prisma.listing.update({
            where: { id: listingId },
            data: { valuationStatus: 'PROCESSING' }
        });

        // Trigger Async Logic (Fire and forget)
        // Trigger Async Logic (Fire and forget)
        (async () => {
            try {
                // --- STAGE 1: Data Gathering (NOAH + OSM) ---
                console.log(`[${listingId}] Entering STAGE1...`);
                await prisma.listing.update({
                    where: { id: listingId },
                    data: { valuationStatus: 'STAGE1' }
                });

                // NOAH Checks (SKIPPED - Offloaded to Gemini for speed)
                // const [riskLevelFlood, riskLevelLandslide, riskLevelStormSurge] = await Promise.all([
                //     checkFloodRisk(listing.latitude, listing.longitude),
                //     checkLandslideRisk(listing.latitude, listing.longitude),
                //     checkStormSurgeRisk(listing.latitude, listing.longitude)
                // ]);

                // console.log(`[STAGE1] NOAH Results - Flood: ${riskLevelFlood}, Landslide: ${riskLevelLandslide}, StormSurge: ${riskLevelStormSurge}`);

                // OSM Hotspots
                const osmData = await getNearbyHotspots(listing.latitude, listing.longitude);
                console.log(`[STAGE1] OSM Data: ${JSON.stringify(osmData, null, 2)}`);

                // Aggregate Risk (DEPRECATED: Handled by Gemini)
                const maxRiskLevel = 'PENDING_AI';

                const riskDetails = {
                    flood: { level: 'unknown', description: 'To be determined by AI' },
                    stormSurge: { level: 'unknown', description: 'To be determined by AI' },
                    landslide: { level: 'unknown', description: 'To be determined by AI' }
                };


                // --- STAGE 2: Image Analysis (Gemini Vision) ---
                console.log(`[${listingId}] Entering STAGE2...`);
                await prisma.listing.update({
                    where: { id: listingId },
                    data: { valuationStatus: 'STAGE2' }
                });

                // Analyze each image
                let totalTokens = 0;
                const imageAnalysisResults = [];
                for (const img of listing.images) {
                    // Convert URL to file path
                    const fileName = path.basename(img.url);
                    const filePath = path.join(process.cwd(), 'uploads', fileName);

                    const analysis = await analyzeImage(filePath);
                    if (analysis.usageMetadata) {
                        totalTokens += analysis.usageMetadata.totalTokenCount || 0;
                    }
                    const { usageMetadata, ...cleanAnalysis } = analysis;
                    imageAnalysisResults.push(cleanAnalysis);
                }


                // --- STAGE 3: Final Valuation (Gemini Pro) ---
                console.log(`[${listingId}] Entering STAGE3...`);
                await prisma.listing.update({
                    where: { id: listingId },
                    data: { valuationStatus: 'STAGE3' }
                });

                // Prepare Context for Gemini
                const contextData = {
                    property: {
                        address: listing.address,
                        type: listing.propertyType,
                        yearBuilt: listing.yearBuilt,
                        lotSize: listing.lotSize,
                        floorArea: listing.lotSize, // Approx
                        titleType: listing.titleType,
                        latitude: listing.latitude,
                        longitude: listing.longitude,
                        askingPrice: listing.price
                    },
                    risks: {
                        level: maxRiskLevel,
                        score: 0, // Placeholder, AI will calculate this
                        details: riskDetails
                    },
                    location: {
                        hotspots: osmData.hotspots,
                        accessibilityScore: osmData.accessibilityScore,
                        locationPremium: osmData.locationPremium
                    },
                    imageFindings: imageAnalysisResults
                };

                console.log(`[STAGE3] Final Context Data for Gemini:`, JSON.stringify(contextData, null, 2));

                // Generate Final Report
                const finalReportWithUsage = await generateFinalValuation(contextData);

                if (finalReportWithUsage && finalReportWithUsage.usageMetadata) {
                    totalTokens += finalReportWithUsage.usageMetadata.totalTokenCount || 0;
                }
                console.log(`[Token Usage] Total Tokens Consumed: ${totalTokens}`);

                const { usageMetadata, ...finalReport } = finalReportWithUsage || {};

                if (!finalReport) throw new Error('Failed to generate final report from Gemini');

                // Filter Redundant Risks from Structural Insights (Response-side only)
                if (finalReport.structuralInsights && Array.isArray(finalReport.structuralInsights.insights)) {
                    finalReport.structuralInsights.insights = finalReport.structuralInsights.insights.filter((insight: any) => {
                        const title = insight.title ? insight.title.toLowerCase() : '';
                        return !title.includes('flood risk') &&
                            !title.includes('landslide risk') &&
                            !title.includes('storm surge');
                    });
                }

                // --- COMPLETED ---
                await prisma.$transaction([
                    prisma.valuation.create({
                        data: {
                            listingId,
                            estimatedValue: finalReport.estimatedValue,
                            finalValuation: finalReport.finalValuation,
                            riskLevel: finalReport.riskLevel || 'LOW', // Use AI result
                            riskScore: finalReport.riskScore || 25,    // Use AI result
                            riskDetails: finalReport.riskDetails || {}, // Use AI result
                            accessibilityScore: osmData.accessibilityScore,
                            nearbyHotspots: osmData.hotspots as any,
                            locationPremium: osmData.locationPremium,
                            aiAnalysis: JSON.stringify(finalReport.aiAnalysis),
                            structuralInsights: finalReport.structuralInsights as any,
                            valuationBreakdown: finalReport.valuationBreakdown as any
                        },
                    }),
                    prisma.listing.update({
                        where: { id: listingId },
                        data: { valuationStatus: 'COMPLETED' }
                    })
                ]);
                console.log(`Valuation completed for ${listingId}`);

            } catch (err) {
                console.error('Async Valuation Error:', err);
                await prisma.listing.update({
                    where: { id: listingId },
                    data: { valuationStatus: 'FAILED' }
                });
            }
        })();

        // Return accepted immediately
        res.status(202).json({ message: 'Valuation started', status: 'PROCESSING' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export default { processValuation };

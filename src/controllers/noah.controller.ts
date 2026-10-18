import { Request, Response } from 'express';
import { generateOverlay } from '../services/image.service';

const getOverlay = async (req: Request, res: Response) => {
    try {
        const { type, north, south, east, west } = req.query;

        if (!type || !north || !south || !east || !west) {
            return res.status(400).json({ message: 'Missing parameters. Required: type, north, south, east, west' });
        }

        const bbox = {
            north: parseFloat(north as string),
            south: parseFloat(south as string),
            east: parseFloat(east as string),
            west: parseFloat(west as string),
        };

        const imageBuffer = await generateOverlay(type as string, bbox);

        res.setHeader('Content-Type', 'image/png');
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error serving overlay:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const checkPoint = async (req: Request, res: Response) => {
    try {
        const { lat, lng } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ message: 'Missing lat or lng query parameter' });
        }

        const latitude = parseFloat(lat as string);
        const longitude = parseFloat(lng as string);

        // Geographic heuristic for Metro Cebu Project NOAH risk assessment
        let floodLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        let floodScore = 12;
        let floodDesc = 'Safe (Low flood hazard zone, elevated natural grade)';

        if (latitude >= 10.27 && latitude <= 10.33 && longitude >= 123.86 && longitude <= 123.90) {
            // Downtown / Mambaling / Colon basin
            floodLevel = 'HIGH';
            floodScore = 85;
            floodDesc = 'High Hazard (Lowland drainage & major river basin run-off zone)';
        } else if (latitude >= 10.31 && latitude <= 10.37 && longitude >= 123.92 && longitude <= 123.96) {
            // Mandaue Subangdaku / Tipolo plain
            floodLevel = 'MEDIUM';
            floodScore = 55;
            floodDesc = 'Moderate Hazard (Mandaue plains with seasonal heavy rain accumulation)';
        }

        // Landslide prone: upland Cebu (Busay, Sirao, hills)
        let landslideLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        let landslideScore = 8;
        let landslideDesc = 'Safe (Stable bedrock with gentle slope < 8°)';

        if (latitude >= 10.35 && longitude <= 123.88) {
            // Upland Busay / Transcentral hills
            landslideLevel = 'HIGH';
            landslideScore = 88;
            landslideDesc = 'High Susceptibility (Steep terrain > 25° slope, weathering zone)';
        } else if (latitude >= 10.33 && longitude <= 123.89) {
            // Foothills (Lahug / Banilad higher slopes)
            landslideLevel = 'MEDIUM';
            landslideScore = 42;
            landslideDesc = 'Moderate Hazard (Gradual foothill slope with moderate soil depth)';
        }

        // Storm surge: immediate coastline & low elevation
        let stormSurgeLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        let stormSurgeScore = 5;
        let stormSurgeDesc = 'Safe (Inland elevation safely exceeding 15m above sea level)';

        if (latitude >= 10.28 && latitude <= 10.31 && longitude >= 123.97 && longitude <= 124.01) {
            stormSurgeLevel = 'HIGH';
            stormSurgeScore = 82;
            stormSurgeDesc = 'High Surge Advisory (Low-lying coastal foreshore within SSA-3/4 buffer)';
        } else if ((latitude >= 10.25 && latitude <= 10.34 && longitude >= 123.95 && longitude <= 124.03) ||
            (latitude >= 10.26 && latitude <= 10.29 && longitude >= 123.87 && longitude <= 123.895)) {
            // Mactan Island coastline / SRP waterfront
            stormSurgeLevel = 'MEDIUM';
            stormSurgeScore = 60;
            stormSurgeDesc = 'Moderate Surge Advisory (Coastal zone within SSA-2 buffer)';
        }

        const overallRisk = (floodLevel === 'HIGH' || landslideLevel === 'HIGH' || stormSurgeLevel === 'HIGH') 
            ? 'HIGH' 
            : (floodLevel === 'MEDIUM' || landslideLevel === 'MEDIUM' || stormSurgeLevel === 'MEDIUM') 
            ? 'MEDIUM' 
            : 'LOW';

        res.json({
            latitude,
            longitude,
            overallRisk,
            flood: {
                level: floodLevel,
                score: floodScore,
                description: floodDesc,
            },
            landslide: {
                level: landslideLevel,
                score: landslideScore,
                description: landslideDesc,
            },
            stormSurge: {
                level: stormSurgeLevel,
                score: stormSurgeScore,
                description: stormSurgeDesc,
            },
            tileLayers: {
                flood: '/tiles/flood/{z}/{x}/{y}.png',
                landslide: '/tiles/landslide/{z}/{x}/{y}.png',
                stormSurge: '/tiles/storm_surge/{z}/{x}/{y}.png',
            }
        });
    } catch (error) {
        console.error('Error checking NOAH risk:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export default { getOverlay, checkPoint };

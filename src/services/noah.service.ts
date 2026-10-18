import * as shapefile from 'shapefile';
import path from 'path';

// Define paths to shapefiles
// Define paths to shapefiles (Updated to correct location)
const NOAH_DATA_PATH = path.join(__dirname, '../../noah');

// Helper to check if a point is inside a polygon
function isPointInPolygon(point: [number, number], vs: [number, number][]) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Helper to process shapefile
async function checkShapefile(filePath: string, lat: number, lng: number): Promise<any> {
    console.log(`[NOAH] Checking file: ${filePath} for Loc: ${lat}, ${lng}`);
    try {
        const source = await shapefile.open(filePath);
        let count = 0;
        while (true) {
            const result = await source.read();
            if (result.done) break;
            count++;

            const feature = result.value;
            let isInside = false;

            if (feature.geometry.type === 'Polygon') {
                const coordinates = feature.geometry.coordinates as [number, number][][];
                if (isPointInPolygon([lng, lat], coordinates[0])) {
                    isInside = true;
                }
            } else if (feature.geometry.type === 'MultiPolygon') {
                const coordinates = feature.geometry.coordinates as [number, number][][][];
                for (const polygon of coordinates) {
                    if (isPointInPolygon([lng, lat], polygon[0])) {
                        isInside = true;
                        break;
                    }
                }
            }

            if (isInside) {
                console.log(`[NOAH] HIT found in ${path.basename(filePath)}! Properties:`, JSON.stringify(feature.properties));
                return feature.properties;
            }
        }
        console.log(`[NOAH] No hit in ${path.basename(filePath)} after checking ${count} features.`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`[NOAH] File NOT FOUND: ${filePath}`);
        } else {
            console.error(`[NOAH] Error reading ${filePath}:`, error.message);
        }
    }
    return null;
}

export const checkFloodRisk = async (lat: number, lng: number): Promise<string> => {
    const shapefilePath = path.join(NOAH_DATA_PATH, 'flood/5yr/Cebu/Cebu/PH072200000_FH_5yr.shp');
    const props = await checkShapefile(shapefilePath, lat, lng);
    console.log(`[NOAH] Flood Risk Props:`, props);

    if (props) {
        const v = props.Var; // Var 1=Low, 2=Medium, 3=High usually
        if (v === 3) return 'HIGH';
        if (v === 2) return 'MEDIUM';
        if (v === 1) return 'LOW';
        return 'MEDIUM'; // Default if present but unknown var
    }
    return 'LOW'; // Safe
}

export const checkLandslideRisk = async (lat: number, lng: number): Promise<string> => {
    const shapefilePath = path.join(NOAH_DATA_PATH, 'landslide/landslidehazards/Cebu/Cebu_LandslideHazards.shp');
    const props = await checkShapefile(shapefilePath, lat, lng);
    console.log(`[NOAH] Landslide Risk Props:`, props);

    if (props) {
        // Check property structure for LH (Landslide Hazard)
        // Usually 'haz' or 'Var'
        // Let's assume standard susceptibility levels if found
        // Inspecting typical NOAH data: Suscep = High, Mod, Low
        const suscep = props.LH || props.Suscep || props.Var;

        // Map common values
        if (typeof suscep === 'string') {
            if (suscep.toLowerCase().includes('high')) return 'HIGH';
            if (suscep.toLowerCase().includes('moderate') || suscep.toLowerCase().includes('medium')) return 'MEDIUM';
            if (suscep.toLowerCase().includes('low')) return 'LOW';
        }
        if (typeof suscep === 'number') {
            if (suscep >= 3) return 'HIGH';
            if (suscep === 2) return 'MEDIUM';
            return 'LOW';
        }
        return 'MEDIUM'; // Default if found
    }
    return 'LOW';
}

export const checkStormSurgeRisk = async (lat: number, lng: number): Promise<string> => {
    // Check highest advisory first (SSA 4 = 3-4 meters? Highest risk)
    const advisories = ['4', '3', '2', '1'];

    for (const adv of advisories) {
        const shapefilePath = path.join(NOAH_DATA_PATH, `storm_surge/storm_surge_advisory_${adv}/Cebu/Cebu_StormSurge_SSA${adv}.shp`);
        const props = await checkShapefile(shapefilePath, lat, lng);
        if (props) {
            console.log(`[NOAH] Storm Surge SSA${adv} HIT!`);
            // Found in this advisory zone
            if (adv === '4' || adv === '3') return 'HIGH';
            if (adv === '2') return 'MEDIUM';
            return 'LOW';
        }
    }
    console.log(`[NOAH] No Storm Surge risk found.`);
    return 'LOW';
}

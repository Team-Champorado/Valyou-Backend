import { createCanvas } from 'canvas';
import * as shapefile from 'shapefile';
import path from 'path';

const NOAH_DATA_PATH = path.join(__dirname, '../../../data/noah');

// Shapefile mappings
const SHAPEFILES: Record<string, string> = {
    FLOOD: path.join(NOAH_DATA_PATH, 'flood/5yr/Cebu/Cebu/PH072200000_FH_5yr.shp'),
    LANDSLIDE: path.join(NOAH_DATA_PATH, 'landslide/landslidehazards/Cebu/Cebu_LandslideHazards.shp'),
    STORM_SURGE: path.join(NOAH_DATA_PATH, 'storm_surge/storm_surge_advisory_4/Cebu/Cebu_StormSurge_SSA4.shp'),
};

interface Bbox {
    north: number;
    south: number;
    east: number;
    west: number;
}

export const generateOverlay = async (type: string, bbox: Bbox): Promise<Buffer> => {
    const width = 512;
    const height = 512;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const shapefilePath = SHAPEFILES[type.toUpperCase()];
    if (!shapefilePath) {
        throw new Error(`Invalid overlay type: ${type}`);
    }

    // Pre-calculate scaling factors
    const mapWidth = bbox.east - bbox.west;
    const mapHeight = bbox.north - bbox.south;

    const toX = (lng: number) => ((lng - bbox.west) / mapWidth) * width;
    const toY = (lat: number) => ((bbox.north - lat) / mapHeight) * height;

    try {
        const source = await shapefile.open(shapefilePath);

        while (true) {
            const result = await source.read();
            if (result.done) break;

            const feature = result.value;

            // Determine color based on hazard level
            let color = 'rgba(128, 128, 128, 0.5)'; // Default

            if (type === 'FLOOD') {
                const v = feature.properties?.Var;
                if (v === 1) color = 'rgba(255, 255, 0, 0.4)'; // Yellow - Low
                if (v === 2) color = 'rgba(255, 165, 0, 0.4)'; // Orange - Medium
                if (v === 3) color = 'rgba(255, 0, 0, 0.4)';   // Red - High
            } else if (type === 'LANDSLIDE') {
                const lh = feature.properties?.LH; // Assuming 'LH' field based on standard MGB maps, might need adjustment
                // Fallback or specific logic
                color = 'rgba(139, 69, 19, 0.4)'; // Brown
            } else if (type === 'STORM_SURGE') {
                const ha = feature.properties?.HAZ; // Assuming HAZ field
                if (ha === 1) color = 'rgba(173, 216, 230, 0.5)'; // Light Blue
                if (ha === 2) color = 'rgba(0, 0, 255, 0.5)';     // Blue
                if (ha === 3) color = 'rgba(0, 0, 139, 0.5)';     // Dark Blue
                // Validating with actual file usage might be needed, used general defaults
                color = 'rgba(0, 0, 255, 0.3)';
            }

            ctx.fillStyle = color;
            ctx.strokeStyle = color.replace('0.4', '0.8').replace('0.5', '1.0').replace('0.3', '0.8'); // Darker border
            ctx.lineWidth = 1;

            const drawPolygon = (coordinates: [number, number][]) => {
                ctx.beginPath();
                if (coordinates.length === 0) return;

                const start = coordinates[0];
                ctx.moveTo(toX(start[0]), toY(start[1]));

                for (let i = 1; i < coordinates.length; i++) {
                    ctx.lineTo(toX(coordinates[i][0]), toY(coordinates[i][1]));
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            };

            if (feature.geometry.type === 'Polygon') {
                const coordinates = feature.geometry.coordinates as [number, number][][];
                // Determine if polygon is roughly in view
                // Simplification: Check if at least one point is in bbox or bbox is in polygon?
                // For now, just draw everything. Optimization: bounding box check.
                drawPolygon(coordinates[0]); // Draw outer ring
            } else if (feature.geometry.type === 'MultiPolygon') {
                const coordinates = feature.geometry.coordinates as [number, number][][][];
                for (const polygon of coordinates) {
                    drawPolygon(polygon[0]);
                }
            }
        }

        return canvas.toBuffer('image/png');
    } catch (error) {
        console.error('Error generating overlay:', error);
        throw error;
    }
};

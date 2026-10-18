"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOverlay = void 0;
const canvas_1 = require("canvas");
const shapefile = __importStar(require("shapefile"));
const path_1 = __importDefault(require("path"));
const NOAH_DATA_PATH = path_1.default.join(__dirname, '../../../data/noah');
// Shapefile mappings
const SHAPEFILES = {
    FLOOD: path_1.default.join(NOAH_DATA_PATH, 'flood/5yr/Cebu/Cebu/PH072200000_FH_5yr.shp'),
    LANDSLIDE: path_1.default.join(NOAH_DATA_PATH, 'landslide/landslidehazards/Cebu/Cebu_LandslideHazards.shp'),
    STORM_SURGE: path_1.default.join(NOAH_DATA_PATH, 'storm_surge/storm_surge_advisory_4/Cebu/Cebu_StormSurge_SSA4.shp'),
};
const generateOverlay = async (type, bbox) => {
    const width = 512;
    const height = 512;
    const canvas = (0, canvas_1.createCanvas)(width, height);
    const ctx = canvas.getContext('2d');
    const shapefilePath = SHAPEFILES[type.toUpperCase()];
    if (!shapefilePath) {
        throw new Error(`Invalid overlay type: ${type}`);
    }
    // Pre-calculate scaling factors
    const mapWidth = bbox.east - bbox.west;
    const mapHeight = bbox.north - bbox.south;
    const toX = (lng) => ((lng - bbox.west) / mapWidth) * width;
    const toY = (lat) => ((bbox.north - lat) / mapHeight) * height;
    try {
        const source = await shapefile.open(shapefilePath);
        while (true) {
            const result = await source.read();
            if (result.done)
                break;
            const feature = result.value;
            // Determine color based on hazard level
            let color = 'rgba(128, 128, 128, 0.5)'; // Default
            if (type === 'FLOOD') {
                const v = feature.properties?.Var;
                if (v === 1)
                    color = 'rgba(255, 255, 0, 0.4)'; // Yellow - Low
                if (v === 2)
                    color = 'rgba(255, 165, 0, 0.4)'; // Orange - Medium
                if (v === 3)
                    color = 'rgba(255, 0, 0, 0.4)'; // Red - High
            }
            else if (type === 'LANDSLIDE') {
                const lh = feature.properties?.LH; // Assuming 'LH' field based on standard MGB maps, might need adjustment
                // Fallback or specific logic
                color = 'rgba(139, 69, 19, 0.4)'; // Brown
            }
            else if (type === 'STORM_SURGE') {
                const ha = feature.properties?.HAZ; // Assuming HAZ field
                if (ha === 1)
                    color = 'rgba(173, 216, 230, 0.5)'; // Light Blue
                if (ha === 2)
                    color = 'rgba(0, 0, 255, 0.5)'; // Blue
                if (ha === 3)
                    color = 'rgba(0, 0, 139, 0.5)'; // Dark Blue
                // Validating with actual file usage might be needed, used general defaults
                color = 'rgba(0, 0, 255, 0.3)';
            }
            ctx.fillStyle = color;
            ctx.strokeStyle = color.replace('0.4', '0.8').replace('0.5', '1.0').replace('0.3', '0.8'); // Darker border
            ctx.lineWidth = 1;
            const drawPolygon = (coordinates) => {
                ctx.beginPath();
                if (coordinates.length === 0)
                    return;
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
                const coordinates = feature.geometry.coordinates;
                // Determine if polygon is roughly in view
                // Simplification: Check if at least one point is in bbox or bbox is in polygon?
                // For now, just draw everything. Optimization: bounding box check.
                drawPolygon(coordinates[0]); // Draw outer ring
            }
            else if (feature.geometry.type === 'MultiPolygon') {
                const coordinates = feature.geometry.coordinates;
                for (const polygon of coordinates) {
                    drawPolygon(polygon[0]);
                }
            }
        }
        return canvas.toBuffer('image/png');
    }
    catch (error) {
        console.error('Error generating overlay:', error);
        throw error;
    }
};
exports.generateOverlay = generateOverlay;

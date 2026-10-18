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
exports.checkFloodRisk = void 0;
const shapefile = __importStar(require("shapefile"));
const path_1 = __importDefault(require("path"));
// Define paths to shapefiles
const NOAH_DATA_PATH = path_1.default.join(__dirname, '../../../data/noah');
// Helper to check if a point is inside a polygon
// Simplified ray casting algorithm
function isPointInPolygon(point, vs) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i][0], yi = vs[i][1];
        const xj = vs[j][0], yj = vs[j][1];
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect)
            inside = !inside;
    }
    return inside;
}
const checkFloodRisk = async (lat, lng) => {
    // Specifically checking the 5yr flood map in Cebu as found in exploration
    const shapefilePath = path_1.default.join(NOAH_DATA_PATH, 'flood/5yr/Cebu/Cebu/PH072200000_FH_5yr.shp');
    try {
        const source = await shapefile.open(shapefilePath);
        let riskLevel = 'LOW';
        while (true) {
            const result = await source.read();
            if (result.done)
                break;
            const feature = result.value;
            if (feature.geometry.type === 'Polygon') {
                const coordinates = feature.geometry.coordinates;
                // Shapefiles often have nested arrays for polygons (rings)
                // We check the outer ring (index 0)
                if (isPointInPolygon([lng, lat], coordinates[0])) {
                    // Check properties for risk level (Var 1, 2, 3)
                    const v = feature.properties?.Var;
                    if (v === 3)
                        return 'HIGH';
                    if (v === 2 && riskLevel !== 'HIGH')
                        riskLevel = 'MEDIUM';
                    if (v === 1 && riskLevel === 'LOW')
                        riskLevel = 'LOW'; // Actually 1 is Low, but if it's already higher don't lower it
                    // Optimization: If we found HIGH, we can probably stop, but overlaps might exist.
                    // For now, let's just return if we find HIGH.
                    if (riskLevel === 'HIGH')
                        return 'HIGH';
                }
            }
            else if (feature.geometry.type === 'MultiPolygon') {
                const coordinates = feature.geometry.coordinates;
                for (const polygon of coordinates) {
                    if (isPointInPolygon([lng, lat], polygon[0])) {
                        const v = feature.properties?.Var;
                        if (v === 3)
                            return 'HIGH';
                        if (v === 2 && riskLevel !== 'HIGH')
                            riskLevel = 'MEDIUM';
                    }
                }
            }
        }
        return riskLevel;
    }
    catch (error) {
        console.error('Error reading shapefile:', error);
        return 'UNKNOWN';
    }
};
exports.checkFloodRisk = checkFloodRisk;

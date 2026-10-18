import { createCanvas } from 'canvas';
import * as shapefile from 'shapefile';
import path from 'path';
import fs from 'fs';
import cliProgress from 'cli-progress';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import os from 'os';
import { long2tile, lat2tile, tile2long, tile2lat } from '../utils/geo';

const NOAH_DATA_PATH = path.join(__dirname, '../../../data/noah');

// Shapefile mappings
const SHAPEFILES: Record<string, string> = {
    FLOOD: path.join(NOAH_DATA_PATH, 'flood/5yr/Cebu/Cebu/PH072200000_FH_5yr.shp'),
    LANDSLIDE: path.join(NOAH_DATA_PATH, 'landslide/landslidehazards/Cebu/Cebu_LandslideHazards.shp'),
    STORM_SURGE: path.join(NOAH_DATA_PATH, 'storm_surge/storm_surge_advisory_4/Cebu/Cebu_StormSurge_SSA4.shp'),
};

const ZOOM_LEVELS = [12];
const BBOX = {
    west: 123.2,
    south: 9.4,
    east: 124.5,
    north: 11.3
};

const OUTPUT_DIR = path.join(__dirname, '../../public/tiles');

interface TileTask {
    type: string;
    z: number;
    x: number;
    y: number;
}

// --- WORKER THREAD ---
if (!isMainThread) {
    const tasks: TileTask[] = workerData;

    // Group by type to minimize file usage
    const tasksByType: Record<string, TileTask[]> = {};
    for (const t of tasks) {
        if (!tasksByType[t.type]) tasksByType[t.type] = [];
        tasksByType[t.type].push(t);
    }

    (async () => {
        for (const [type, typeTasks] of Object.entries(tasksByType)) {
            const shpPath = SHAPEFILES[type];
            if (!shpPath) continue;

            // Load features
            const features = [];
            try {
                const source = await shapefile.open(shpPath);
                while (true) {
                    const result = await source.read();
                    if (result.done) break;
                    features.push(result.value);
                }
            } catch (e) {
                console.error(`Worker failed ` + type, e);
                continue;
            }

            for (const task of typeTasks) {
                await renderTile(task.type, task.z, task.x, task.y, features);
                parentPort?.postMessage('tick');
            }
        }
        process.exit(0);
    })();
}

// --- MAIN THREAD ---
else {
    (async () => {
        console.log(`Generating render tasks (Skipping coverage analysis)...`);
        const allTasks: TileTask[] = [];

        for (const type of Object.keys(SHAPEFILES)) {
            for (const z of ZOOM_LEVELS) {
                const minX = long2tile(BBOX.west, z);
                const maxX = long2tile(BBOX.east, z);
                const minY = lat2tile(BBOX.north, z);
                const maxY = lat2tile(BBOX.south, z);

                for (let x = minX; x <= maxX; x++) {
                    for (let y = minY; y <= maxY; y++) {
                        allTasks.push({ type, z, x, y });
                    }
                }
            }
        }

        const numCPUs = os.cpus().length;
        console.log(`Found ${numCPUs} CPUs. Total ${allTasks.length} tiles to scan.`);

        if (allTasks.length === 0) {
            console.log("No tiles to render.");
            process.exit(0);
        }

        const chunkSize = Math.ceil(allTasks.length / numCPUs);
        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        bar.start(allTasks.length, 0);

        let completed = 0;
        let workersDone = 0;

        for (let i = 0; i < numCPUs; i++) {
            const start = i * chunkSize;
            const end = start + chunkSize;
            const chunk = allTasks.slice(start, end);

            if (chunk.length === 0) {
                workersDone++;
                if (workersDone === numCPUs) bar.stop(); // Edge case
                continue;
            }

            // Important: execArgv needed for ts-node in worker
            const worker = new Worker(__filename, {
                workerData: chunk,
                execArgv: /\.ts$/.test(__filename) ? ['--require', 'ts-node/register'] : undefined
            });

            worker.on('message', (msg) => {
                if (msg === 'tick') {
                    completed++;
                    bar.update(completed);
                }
            });

            worker.on('error', (err) => {
                console.error('Worker error:', err);
            });

            worker.on('exit', () => {
                workersDone++;
                if (workersDone === numCPUs) {
                    bar.stop();
                    console.log('All workers finished.');
                }
            });
        }
    })();
}

function getGeoJSONBounds(geometry: any) {
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    const processCoords = (coords: any[]) => {
        // Deep recursion to handle MultiPolygon array nesting [ [ [x,y] ] ]
        if (typeof coords[0] === 'number') {
            const lng = coords[0];
            const lat = coords[1];
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        } else {
            for (const c of coords) processCoords(c);
        }
    };

    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        processCoords(geometry.coordinates);
    } else {
        return null;
    }

    return {
        north: maxLat,
        south: minLat,
        east: maxLng,
        west: minLng
    };
}

// --- RENDER LOGIC (Shared) ---
async function renderTile(type: string, z: number, x: number, y: number, features: any[]) {
    // ... [Same render code logic as before, just copied here for scope access] ...
    // To keep file clean, I'll paste the logic again.

    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');

    const tileWest = tile2long(x, z);
    const tileEast = tile2long(x + 1, z);
    const tileNorth = tile2lat(y, z);
    const tileSouth = tile2lat(y + 1, z);

    const mapWidth = tileEast - tileWest;
    const mapHeight = tileNorth - tileSouth;

    const toX = (lng: number) => ((lng - tileWest) / mapWidth) * 256;
    const toY = (lat: number) => ((tileNorth - lat) / mapHeight) * 256;

    let hasContent = false;

    // Fast bbox check using feature's own bounds if available
    // Assuming GeoJSON features might not have precomputed bbox, checking every point is expensive.
    // Simplest optimization: Check if tile is roughly intersecting the feature (if feature is small).
    // Given features are large polygons, stick to iterating.

    for (const feature of features) {

        let color = 'rgba(128, 128, 128, 0.5)';
        if (type === 'FLOOD') {
            const v = feature.properties?.Var;
            if (v === 1) color = 'rgba(255, 255, 0, 0.5)';
            if (v === 2) color = 'rgba(255, 165, 0, 0.5)';
            if (v === 3) color = 'rgba(255, 0, 0, 0.5)';
        } else if (type === 'LANDSLIDE') {
            color = 'rgba(139, 69, 19, 0.5)';
        } else if (type === 'STORM_SURGE') {
            const ha = feature.properties?.HAZ;
            if (ha === 1) color = 'rgba(173, 216, 230, 0.5)';
            if (ha === 2) color = 'rgba(0, 0, 255, 0.5)';
            if (ha === 3) color = 'rgba(0, 0, 139, 0.5)';
        }

        ctx.fillStyle = color;
        // ctx.strokeStyle = color.replace('0.5', '0.8');
        // ctx.lineWidth = 1;

        const drawPolygon = (coordinates: [number, number][]) => {

            ctx.beginPath();
            let first = true;
            for (const coord of coordinates) {
                const px = toX(coord[0]);
                const py = toY(coord[1]);
                if (first) {
                    ctx.moveTo(px, py);
                    first = false;
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();
            ctx.fill();
            hasContent = true;
        };

        if (feature.geometry.type === 'Polygon') {
            drawPolygon(feature.geometry.coordinates[0] as [number, number][]);
        } else if (feature.geometry.type === 'MultiPolygon') {
            for (const poly of feature.geometry.coordinates) {
                drawPolygon(poly[0] as [number, number][]);
            }
        }
    }

    if (hasContent) {
        const dir = path.join(OUTPUT_DIR, type.toLowerCase(), z.toString(), x.toString());
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(path.join(dir, `${y}.png`), buffer);
    }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const image_service_1 = require("../services/image.service");
const getOverlay = async (req, res) => {
    try {
        const { type, north, south, east, west } = req.query;
        if (!type || !north || !south || !east || !west) {
            return res.status(400).json({ message: 'Missing parameters. Required: type, north, south, east, west' });
        }
        const bbox = {
            north: parseFloat(north),
            south: parseFloat(south),
            east: parseFloat(east),
            west: parseFloat(west),
        };
        const imageBuffer = await (0, image_service_1.generateOverlay)(type, bbox);
        res.setHeader('Content-Type', 'image/png');
        res.send(imageBuffer);
    }
    catch (error) {
        console.error('Error serving overlay:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.default = { getOverlay };

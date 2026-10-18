"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const noah_controller_1 = __importDefault(require("../controllers/noah.controller"));
const router = (0, express_1.Router)();
/**
 * @swagger
 * /noah/overlay:
 *   get:
 *     summary: Get hazard map overlay
 *     tags: [NOAH]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [FLOOD, LANDSLIDE, STORM_SURGE]
 *         required: true
 *       - in: query
 *         name: north
 *         schema:
 *           type: number
 *         required: true
 *       - in: query
 *         name: south
 *         schema:
 *           type: number
 *         required: true
 *       - in: query
 *         name: east
 *         schema:
 *           type: number
 *         required: true
 *       - in: query
 *         name: west
 *         schema:
 *           type: number
 *         required: true
 *     responses:
 *       200:
 *         description: PNG image
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/noah/overlay', noah_controller_1.default.getOverlay);
exports.default = router;

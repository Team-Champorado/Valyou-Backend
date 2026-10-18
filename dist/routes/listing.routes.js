"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const listing_controller_1 = __importDefault(require("../controllers/listing.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// Reuse multer config (can be moved to a util)
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({ storage });
const valuation_controller_1 = __importDefault(require("../controllers/valuation.controller"));
/**
 * @swagger
 * /listing:
 *   get:
 *     summary: Get user listings
 *     tags: [Listing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of listings
 */
router.get('/listing', auth_middleware_1.authenticateToken, listing_controller_1.default.getListings);
/**
 * @swagger
 * /listing/new:
 *   post:
 *     summary: Create a new listing
 *     tags: [Listing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               price:
 *                 type: number
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Listing created
 */
router.post('/listing/new', auth_middleware_1.authenticateToken, upload.array('images', 5), listing_controller_1.default.createListing);
/**
 * @swagger
 * /listing/{id}:
 *   get:
 *     summary: Get a listing by ID
 *     tags: [Listing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Listing details
 *       404:
 *         description: Listing not found
 */
router.get('/listing/:id', listing_controller_1.default.getListingById);
/**
 * @swagger
 * /listing/{id}:
 *   delete:
 *     summary: Delete a listing
 *     tags: [Listing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Listing deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Listing not found
 */
router.delete('/listing/:id', auth_middleware_1.authenticateToken, listing_controller_1.default.deleteListing);
/**
 * @swagger
 * /listing/{id}/process:
 *   post:
 *     summary: Create valuation for a listing
 *     tags: [Listing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Valuation result
 */
router.post('/listing/:id/process', auth_middleware_1.authenticateToken, valuation_controller_1.default.processValuation);
exports.default = router;

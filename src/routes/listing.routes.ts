import { Router } from 'express';
import listingController from '../controllers/listing.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Reuse multer config (can be moved to a util)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

import valuationController from '../controllers/valuation.controller';

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
router.get('/listing', authenticateToken, listingController.getListings);

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
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               address:
 *                 type: string
 *               lotSize:
 *                 type: number
 *               yearBuilt:
 *                 type: integer
 *               propertyType:
 *                 type: string
 *               parkingSpaces:
 *                 type: integer
 *               titleType:
 *                 type: string
 *               isRenovated:
 *                 type: boolean
 *               renovationDetails:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Listing created
 */
router.post('/listing/new', authenticateToken, upload.array('images', 5), listingController.createListing);

/**
 * @swagger
 * /listing/{id}:
 *   get:
 *     summary: Get a listing by ID (includes valuation status)
 *     tags: [Listing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Listing details with valuation status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 valuationStatus:
 *                   type: string
 *                   enum: [PENDING, PROCESSING, STAGE1, STAGE2, STAGE3, COMPLETED, FAILED]
 *                 valuations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       estimatedValue:
 *                         type: number
 *                       finalValuation:
 *                         type: number
 *                       riskLevel:
 *                         type: string
 *                       riskDetails:
 *                         type: object
 *       404:
 *         description: Listing not found
 */
router.get('/listing/:id', listingController.getListingById);

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
router.delete('/listing/:id', authenticateToken, listingController.deleteListing);

/**
 * @swagger
 * /listing/{id}/process:
 *   post:
 *     summary: Trigger async valuation process for a listing
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
 *       202:
 *         description: Valuation started (Async)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: PROCESSING
 *       200:
 *         description: Valuation already completed (returns result immediately)
 */
router.post('/listing/:id/process', authenticateToken, valuationController.processValuation);

export default router;

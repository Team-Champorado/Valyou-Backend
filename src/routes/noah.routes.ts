import { Router } from 'express';
import noahController from '../controllers/noah.controller';

const router = Router();

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
router.get('/noah/overlay', noahController.getOverlay);
router.get('/noah/check', noahController.checkPoint);

export default router;


import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

import authRoutes from './routes/auth.routes';
import listingRoutes from './routes/listing.routes';
import noahRoutes from './routes/noah.routes';

app.use('/api', authRoutes);
app.use('/api', listingRoutes);
app.use('/api', noahRoutes);

// Basic route
app.get('/', (req, res) => {
    res.send('Valyou Backend is running');
});

import swaggerUi from 'swagger-ui-express';
import specs from './swagger';

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Serve static files for uploaded images (future proofing)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/tiles', express.static(path.join(__dirname, '../public/tiles')));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} `);
});

export { app, prisma };

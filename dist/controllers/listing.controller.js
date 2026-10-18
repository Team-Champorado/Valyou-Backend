"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const createListing = async (req, res) => {
    try {
        const { title, description, address, latitude, longitude, price } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        // Handle multiple files
        const files = req.files;
        const imagesData = files?.map((file) => ({
            url: `/uploads/${file.filename}`,
        })) || [];
        if (imagesData.length > 5) {
            return res.status(400).json({ message: 'Max 5 images allowed' });
        }
        const listing = await index_1.prisma.listing.create({
            data: {
                userId,
                title,
                description,
                address,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                price: parseFloat(price),
                images: {
                    create: imagesData,
                },
            },
            include: {
                images: true,
            },
        });
        res.status(201).json(listing);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
const getListings = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const listings = await index_1.prisma.listing.findMany({
            where: { userId },
            include: { images: true },
        });
        res.json(listings);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
const getListingById = async (req, res) => {
    try {
        const { id } = req.params;
        const listingId = id;
        const listing = await index_1.prisma.listing.findUnique({
            where: { id: listingId },
            include: { images: true, valuations: true },
        });
        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }
        res.json(listing);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
const deleteListing = async (req, res) => {
    try {
        const { id } = req.params;
        const listingId = id;
        const userId = req.user?.userId;
        const listing = await index_1.prisma.listing.findUnique({ where: { id: listingId } });
        if (!listing) {
            return res.status(404).json({ message: 'Listing not found' });
        }
        if (listing.userId !== userId) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        await index_1.prisma.listing.delete({ where: { id: listingId } });
        res.json({ message: 'Listing deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.default = { createListing, getListings, getListingById, deleteListing };

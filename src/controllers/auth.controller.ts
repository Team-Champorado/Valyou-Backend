import { Request, Response } from 'express';
import { prisma } from '../index';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const register = async (req: Request, res: Response) => {
    try {
        const { email, password, firstName, middleName, lastName, phoneNumber } = req.body;
        const profilePicture = req.file ? `/uploads/${req.file.filename}` : null;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                middleName,
                lastName,
                phoneNumber,
                profilePicture,
            },
        });

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1d' });

        res.status(201).json({ token, user: { id: user.id, email: user.email, firstName: user.firstName } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1d' });

        res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const logout = async (req: Request, res: Response) => {
    // In a stateless JWT auth, logout is handled by the client removing the token.
    // However, if we wanted to blacklist tokens, we would do it here.
    // For now, we just return success.
    res.json({ message: 'Logged out successfully' });
};

export default { register, login, logout };

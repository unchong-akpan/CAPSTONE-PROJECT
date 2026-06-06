import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';
import { ENV } from '../config/env';

const getJwtSecret = () => process.env.JWT_SECRET || ENV.JWT_SECRET;

const router = express.Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Register a creator or eventee
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, role]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [CREATOR, EVENTEE]
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Server error
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Login and receive a JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'email, password, name, and role are required' });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role },
    });
    const signOptions: SignOptions = { expiresIn: ENV.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
    const token = jwt.sign({ userId: user.id, role: user.role }, getJwtSecret(), signOptions);
    return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    logger.error('Register error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const signOptions: SignOptions = { expiresIn: ENV.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
    const token = jwt.sign({ userId: user.id, role: user.role }, getJwtSecret(), signOptions);
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    logger.error('Login error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

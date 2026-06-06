import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || ENV.JWT_SECRET;
    const payload = jwt.verify(token, secret) as { userId: string; role: string };
    req.user = payload;
    next();
  } catch (err) {
    logger.error('JWT verification failed:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

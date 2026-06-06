import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const requireRole = (role: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.role) {
      return res.status(403).json({ error: 'No role information' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Requires ${role} role` });
    }
    next();
  };
};
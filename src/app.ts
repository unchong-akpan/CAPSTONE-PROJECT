import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import authRouter from './routes/auth';
import eventsRouter from './routes/events';
import ticketsRouter from './routes/tickets';
import analyticsRouter from './routes/analytics';
import paymentsRouter from './routes/payments';
import { swaggerSpec } from './config/swagger';
import { logger } from './utils/logger';

const app = express();
const publicDir = path.join(process.cwd(), 'public');

// Security middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

// Simple rate limiter: 100 req per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
app.use(limiter);

// Routes
app.use('/auth', authRouter);
app.use('/events', eventsRouter);
app.use('/tickets', ticketsRouter);
app.use('/analytics', analyticsRouter);
app.use('/payments', paymentsRouter);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Global error handler (must be last middleware)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', err);
  
  // Prevent sending response twice
  if (res.headersSent) {
    return;
  }
  
  // Handle different error types
  if (err instanceof Error) {
    logger.error('Error message:', err.message);
    logger.error('Error stack:', err.stack);
  }
  
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;

import app from './app';
import './jobs/reminderJob';
import { ENV } from './config/env';
import { prisma } from './config/db';
import { logger } from './utils/logger';

const start = async () => {
  try {
    await prisma.$connect();
    app.listen(ENV.PORT, () => {
      logger.info(`Server listening on port ${ENV.PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
};

start();

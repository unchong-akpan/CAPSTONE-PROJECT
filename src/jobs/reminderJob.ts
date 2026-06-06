import cron from 'node-cron';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';

// Schedule to run every minute
cron.schedule('* * * * *', async () => {
  try {
    const processedCount = await NotificationService.processPendingReminders();
    logger.info(`Processed ${processedCount} pending reminders`);
  } catch (error) {
    logger.error('Error while processing pending reminders', error);
  }
});

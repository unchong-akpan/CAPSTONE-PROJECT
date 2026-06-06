import { prisma } from '../config/db';
import { EmailService } from './email.service';
import { logger } from '../utils/logger';

export class NotificationService {
  /**
   * Schedules a reminder for a user and event
   */
  static async scheduleReminder(userId: string, eventId: string, sendAt: Date, type: 'CREATOR_SET' | 'EVENTEE_SET'): Promise<void> {
    try {
      // Prevent scheduling in the past
      if (sendAt.getTime() <= Date.now()) {
        logger.info(`Reminder send time ${sendAt.toISOString()} is in the past. Skipping schedule.`);
        return;
      }

      // Check if reminder already exists for the user + event + type
      const exists = await prisma.reminder.findFirst({
        where: {
          userId,
          eventId,
          type,
          status: 'PENDING',
        },
      });

      if (exists) {
        // Update the existing reminder's send date
        await prisma.reminder.update({
          where: { id: exists.id },
          data: { sendAt },
        });
        logger.info(`Updated existing pending reminder ID [${exists.id}] to send at ${sendAt.toISOString()}`);
      } else {
        const reminder = await prisma.reminder.create({
          data: {
            userId,
            eventId,
            sendAt,
            type,
            status: 'PENDING',
          },
        });
        logger.info(`Scheduled new reminder ID [${reminder.id}] for user ${userId} on event ${eventId} at ${sendAt.toISOString()}`);
      }
    } catch (error) {
      logger.error('Failed to schedule reminder:', error);
    }
  }

  /**
   * Helper to parse reminder intervals (e.g. "1_DAY", "1_WEEK", "2_HOURS")
   */
  static calculateReminderTime(eventDate: Date, interval: string): Date | null {
    const time = new Date(eventDate).getTime();
    
    switch (interval.toUpperCase()) {
      case '1_DAY':
        return new Date(time - 24 * 60 * 60 * 1000);
      case '1_WEEK':
        return new Date(time - 7 * 24 * 60 * 60 * 1000);
      case 'NONE':
        return null;
      default:
        // Parse format e.g. "2_HOURS" or "3_DAYS"
        const parts = interval.split('_');
        if (parts.length === 2) {
          const value = parseInt(parts[0], 10);
          const unit = parts[1].toUpperCase();
          if (!isNaN(value)) {
            if (unit === 'HOURS' || unit === 'HOUR') {
              return new Date(time - value * 60 * 60 * 1000);
            }
            if (unit === 'DAYS' || unit === 'DAY') {
              return new Date(time - value * 24 * 60 * 60 * 1000);
            }
            if (unit === 'MINUTES' || unit === 'MINUTE') {
              return new Date(time - value * 60 * 1000);
            }
          }
        }
        return null;
    }
  }

  /**
   * Background task to process and dispatch due reminders
   */
  static async processPendingReminders(): Promise<number> {
    const now = new Date();
    try {
      const pendingReminders = await prisma.reminder.findMany({
        where: {
          status: 'PENDING',
          sendAt: {
            lte: now,
          },
        },
        include: {
          user: true,
          event: true,
        },
      });

      if (pendingReminders.length === 0) {
        return 0;
      }

      logger.info(`Found ${pendingReminders.length} pending reminders due for dispatch`);

      let successCount = 0;
      for (const reminder of pendingReminders) {
        logger.info(`Dispatching reminder ID [${reminder.id}] to ${reminder.user.email}`);
        
        const emailSent = await EmailService.sendReminderEmail(
          reminder.user.email,
          reminder.user.name,
          {
            title: reminder.event.title,
            location: reminder.event.location,
            date: reminder.event.date,
          }
        );

        await prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            status: emailSent ? 'SENT' : 'FAILED',
          },
        });

        if (emailSent) successCount++;
      }

      logger.info(`Successfully dispatched ${successCount}/${pendingReminders.length} due reminders`);
      return successCount;
    } catch (error) {
      logger.error('Failed to process pending reminders:', error);
      return 0;
    }
  }
}

export default NotificationService;

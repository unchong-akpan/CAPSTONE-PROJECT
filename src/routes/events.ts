import express from 'express';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { CacheService } from '../services/cache.service';
import NotificationService from '../services/notification.service';

const router = express.Router();
const EVENTS_CACHE_KEY = 'events:upcoming';

/**
 * @openapi
 * /events:
 *   get:
 *     tags:
 *       - Events
 *     summary: List upcoming events
 *     responses:
 *       200:
 *         description: Upcoming events
 *   post:
 *     tags:
 *       - Events
 *     summary: Create an event as a creator
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, date, totalCapacity]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               price:
 *                 type: number
 *               totalCapacity:
 *                 type: integer
 *               creatorReminderInterval:
 *                 type: string
 *     responses:
 *       201:
 *         description: Event created
 *       403:
 *         description: Requires CREATOR role
 * /events/me:
 *   get:
 *     tags:
 *       - Events
 *     summary: Get events for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User-specific events
 * /events/{id}:
 *   get:
 *     tags:
 *       - Events
 *     summary: Get a single event
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event details
 *       404:
 *         description: Event not found
 * /events/{id}/share:
 *   get:
 *     tags:
 *       - Events
 *     summary: Build share links for social platforms
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Share payload
 * /events/{id}/reminders:
 *   post:
 *     tags:
 *       - Events
 *     summary: Schedule a reminder for an event
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sendAt:
 *                 type: string
 *                 format: date-time
 *               interval:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reminder scheduled
 */

// Public: list all upcoming events
router.get('/', async (req, res) => {
  try {
    const cachedEvents = await CacheService.get<any[]>(EVENTS_CACHE_KEY);
    if (cachedEvents) {
      return res.json(cachedEvents);
    }

    const events = await prisma.event.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: 'asc' },
    });

    await CacheService.set(EVENTS_CACHE_KEY, events, 120);
    res.json(events);
  } catch (err) {
    logger.error('Fetch events error', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Authenticated: get events relevant to the current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role === 'CREATOR') {
      const events = await prisma.event.findMany({
        where: { creatorId: req.user.userId },
        orderBy: { date: 'desc' },
        include: {
          tickets: {
            select: {
              id: true,
              eventeeId: true,
              isScanned: true,
              scannedAt: true,
            },
          },
          payments: {
            select: {
              id: true,
              reference: true,
              status: true,
              amount: true,
              eventeeId: true,
              ticketId: true,
            },
          },
        },
      });

      return res.json({ role: 'CREATOR', events });
    }

    const tickets = await prisma.ticket.findMany({
      where: { eventeeId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        event: true,
      },
    });

    return res.json({
      role: 'EVENTEE',
      events: tickets.map((ticket) => ({
        ticketId: ticket.id,
        ticketStatus: ticket.isScanned ? 'SCANNED' : 'ACTIVE',
        qrCodeData: ticket.qrCodeData,
        verificationToken: ticket.verificationToken,
        event: ticket.event,
      })),
    });
  } catch (err) {
    logger.error('Fetch my events error', err);
    res.status(500).json({ error: 'Failed to fetch your events' });
  }
});

// Public: get event details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const cacheKey = `event:${id}`;
    const cachedEvent = await CacheService.get<any>(cacheKey);
    if (cachedEvent) {
      return res.json(cachedEvent);
    }

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    await CacheService.set(cacheKey, event, 120);
    res.json(event);
  } catch (err) {
    logger.error('Fetch event error', err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Public share payload for social platforms
router.get('/:id/share', async (req, res) => {
  const { id } = req.params;

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const eventUrl = `${baseUrl}/events/${event.id}`;

    return res.json({
      eventId: event.id,
      title: event.title,
      shareUrl: eventUrl,
      shareText: `Check out ${event.title} on Eventful`,
      platforms: {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(`${event.title} ${eventUrl}`)}`,
        x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${event.title} ${eventUrl}`)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(eventUrl)}`,
      },
    });
  } catch (err) {
    logger.error('Share event error', err);
    return res.status(500).json({ error: 'Failed to build share links' });
  }
});

// Creator creates an event
router.post('/', authenticate, requireRole('CREATOR'), async (req: AuthRequest, res) => {
  const { title, description, location, date, price, totalCapacity, creatorReminderInterval } = req.body;
  if (!title || !date || !totalCapacity) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        date: new Date(date),
        price: price ?? 0,
        totalCapacity,
        availableTickets: totalCapacity,
        creatorReminderInterval: creatorReminderInterval ?? 'NONE',
        creatorId: req.user!.userId,
      },
    });

    const reminderTime = NotificationService.calculateReminderTime(
      event.date,
      event.creatorReminderInterval
    );

    if (reminderTime) {
      await NotificationService.scheduleReminder(
        req.user!.userId,
        event.id,
        reminderTime,
        'CREATOR_SET'
      );
    }

    await CacheService.invalidatePattern('event:*');
    await CacheService.delete(EVENTS_CACHE_KEY);

    res.status(201).json(event);
  } catch (err) {
    logger.error('Create event error', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Creator or eventee sets a custom reminder for an event
router.post('/:id/reminders', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { sendAt, interval } = req.body as { sendAt?: string; interval?: string };

  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const reminderTime =
      sendAt ? new Date(sendAt) : interval ? NotificationService.calculateReminderTime(event.date, interval) : null;

    if (!reminderTime || Number.isNaN(reminderTime.getTime())) {
      return res.status(400).json({ error: 'Provide a valid sendAt or interval' });
    }

    const reminderType = req.user?.role === 'CREATOR' ? 'CREATOR_SET' : 'EVENTEE_SET';
    await NotificationService.scheduleReminder(req.user!.userId, event.id, reminderTime, reminderType);

    return res.status(201).json({
      message: 'Reminder scheduled',
      eventId: event.id,
      sendAt: reminderTime.toISOString(),
      type: reminderType,
    });
  } catch (err) {
    logger.error('Schedule reminder error', err);
    return res.status(500).json({ error: 'Failed to schedule reminder' });
  }
});

export default router;

import express from 'express';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { CacheService } from '../services/cache.service';

const router = express.Router();

const buildSummary = (tickets: Array<{ eventId: string; eventeeId: string; pricePaid: number; isScanned: boolean }>) => {
  const ticketsSold = tickets.length;
  const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.pricePaid, 0);
  const uniqueAttendees = new Set(tickets.map((ticket) => ticket.eventeeId)).size;
  const scannedTickets = tickets.filter((ticket) => ticket.isScanned).length;

  return { ticketsSold, totalRevenue, uniqueAttendees, scannedTickets };
};

const getCreatorAnalytics = async (creatorId: string) => {
  const cacheKey = `analytics:creator:${creatorId}`;
  const cached = await CacheService.get<any>(cacheKey);
  if (cached) {
    return cached;
  }

  const events = await prisma.event.findMany({
    where: { creatorId },
    select: { id: true, title: true, date: true },
  });

  const tickets = await prisma.ticket.findMany({
    where: { event: { creatorId } },
    select: {
      eventId: true,
      eventeeId: true,
      pricePaid: true,
      isScanned: true,
    },
  });

  const eventBreakdown = events.map((event) => {
    const eventTickets = tickets.filter((ticket) => ticket.eventId === event.id);
    return {
      eventId: event.id,
      title: event.title,
      date: event.date,
      ...buildSummary(eventTickets),
    };
  });

  const payload = {
    creatorId,
    totalEvents: events.length,
    ...buildSummary(tickets),
    events: eventBreakdown,
  };

  await CacheService.set(cacheKey, payload, 60);
  return payload;
};

/**
 * @openapi
 * /analytics/creator/me:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get analytics for the authenticated creator
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Creator analytics
 * /analytics/creator/{creatorId}:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Backward compatible creator analytics route
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Creator analytics
 * /analytics/events/{eventId}:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get analytics for a single creator-owned event
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event analytics
 */

// Creator analytics for the authenticated user
router.get('/creator/me', authenticate, requireRole('CREATOR'), async (req: AuthRequest, res) => {
  try {
    const payload = await getCreatorAnalytics(req.user!.userId);
    return res.json(payload);
  } catch (err) {
    logger.error('Analytics error', err);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Backward-compatible creator analytics route
router.get('/creator/:creatorId', authenticate, requireRole('CREATOR'), async (req: AuthRequest, res) => {
  if (req.params.creatorId !== req.user!.userId) {
    return res.status(403).json({ error: 'You can only view your own analytics' });
  }

  try {
    const payload = await getCreatorAnalytics(req.user!.userId);
    return res.json(payload);
  } catch (err) {
    logger.error('Analytics error', err);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Analytics for a single event owned by the creator
router.get('/events/:eventId', authenticate, requireRole('CREATOR'), async (req: AuthRequest, res) => {
  const { eventId } = req.params;

  try {
    const cacheKey = `analytics:event:${eventId}`;
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        creatorId: true,
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.creatorId !== req.user!.userId) {
      return res.status(403).json({ error: 'You can only view analytics for your own events' });
    }

    const tickets = await prisma.ticket.findMany({
      where: { eventId },
      select: {
        eventId: true,
        eventeeId: true,
        pricePaid: true,
        isScanned: true,
      },
    });

    const payload = {
      event,
      ...buildSummary(tickets),
    };

    await CacheService.set(cacheKey, payload, 60);
    return res.json(payload);
  } catch (err) {
    logger.error('Event analytics error', err);
    return res.status(500).json({ error: 'Failed to fetch event analytics' });
  }
});

export default router;

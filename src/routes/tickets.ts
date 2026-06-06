import express from 'express';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { QRCodeService } from '../services/qrcode.service';
import { PaymentService } from '../services/payment.service';
import { EmailService } from '../services/email.service';
import { CacheService } from '../services/cache.service';

const router = express.Router();

/**
 * @openapi
 * /tickets/events/{eventId}/purchase:
 *   post:
 *     tags:
 *       - Tickets
 *     summary: Purchase a ticket for an event
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
 *         description: Payment URL and ticket ID
 * /tickets/me:
 *   get:
 *     tags:
 *       - Tickets
 *     summary: View tickets owned by the authenticated eventee
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ticket list
 * /tickets/scan:
 *   post:
 *     tags:
 *       - Tickets
 *     summary: Verify a ticket QR code as a creator
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [verificationToken]
 *             properties:
 *               verificationToken:
 *                 type: string
 *               eventId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket verified
 */

// Eventee purchases a ticket (creates payment and ticket record)
router.post('/events/:eventId/purchase', authenticate, async (req: AuthRequest, res) => {
  const { eventId } = req.params;
  const userId = req.user!.userId;
  try {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.availableTickets <= 0) return res.status(400).json({ error: 'No tickets available' });

    // Load user for email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Initialize payment (mock or real)
    const callbackUrl = `${req.protocol}://${req.get('host')}/payments/callback`;
    const paymentInit = await PaymentService.initializeTransaction(user.email, event.price, callbackUrl);

    // Create ticket with pending payment reference
    const verificationToken = QRCodeService.generateVerificationToken();
    const qrCodeData = await QRCodeService.generateQRCode(verificationToken);
    const ticket = await prisma.ticket.create({
      data: {
        eventId: event.id,
        eventeeId: user.id,
        verificationToken,
        qrCodeData,
        paymentReference: paymentInit.reference,
        pricePaid: event.price,
      },
    });

    // Decrement available tickets
    await prisma.event.update({
      where: { id: event.id },
      data: { availableTickets: { decrement: 1 } },
    });

    await CacheService.invalidatePattern('event:*');
    await CacheService.delete('events:upcoming');

    // Send confirmation email with QR
    await EmailService.sendTicketEmail(
      user.email,
      user.name,
      { title: event.title, location: event.location, date: event.date },
      ticket.id,
      qrCodeData
    );

    res.json({ ticketId: ticket.id, paymentUrl: paymentInit.authorization_url });
  } catch (err) {
    logger.error('Ticket purchase error', err);
    res.status(500).json({ error: 'Failed to purchase ticket' });
  }
});

// Eventee views their own tickets
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { eventeeId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        event: true,
      },
    });

    return res.json({
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        eventId: ticket.eventId,
        event: ticket.event,
        isScanned: ticket.isScanned,
        scannedAt: ticket.scannedAt,
        verificationToken: ticket.verificationToken,
      })),
    });
  } catch (err) {
    logger.error('Fetch tickets error', err);
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Creator verifies/scans a ticket QR code
router.post('/scan', authenticate, requireRole('CREATOR'), async (req: AuthRequest, res) => {
  const { verificationToken, eventId } = req.body as { verificationToken?: string; eventId?: string };

  if (!verificationToken) {
    return res.status(400).json({ error: 'verificationToken is required' });
  }

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { verificationToken },
      include: {
        event: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (ticket.event.creatorId !== req.user!.userId) {
      return res.status(403).json({ error: 'You can only scan tickets for your own events' });
    }

    if (eventId && ticket.eventId !== eventId) {
      return res.status(400).json({ error: 'Ticket does not belong to the supplied event' });
    }

    if (ticket.isScanned) {
      return res.status(409).json({ error: 'Ticket already scanned', scannedAt: ticket.scannedAt });
    }

    const scannedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        isScanned: true,
        scannedAt: new Date(),
      },
      include: {
        event: true,
      },
    });

    await CacheService.delete(`analytics:event:${ticket.eventId}`);
    await CacheService.delete(`analytics:creator:${ticket.event.creatorId}`);

    return res.json({
      message: 'Ticket verified',
      ticketId: scannedTicket.id,
      eventId: scannedTicket.eventId,
      scannedAt: scannedTicket.scannedAt,
    });
  } catch (err) {
    logger.error('Scan ticket error', err);
    return res.status(500).json({ error: 'Failed to scan ticket' });
  }
});

export default router;

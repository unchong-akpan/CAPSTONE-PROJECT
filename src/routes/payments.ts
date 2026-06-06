import express from 'express';
import { prisma } from '../config/db';
import { PaymentService } from '../services/payment.service';
import { logger } from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { CacheService } from '../services/cache.service';

const router = express.Router();

/**
 * @openapi
 * /payments/callback:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Verify a Paystack callback reference
 *     parameters:
 *       - in: query
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment verified
 * /payments/mock-checkout:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Local mock checkout redirect
 *     parameters:
 *       - in: query
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirects to payment callback
 * /payments/creator/me:
 *   get:
 *     tags:
 *       - Payments
 *     summary: View payment details for the authenticated creator
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Creator payments
 */
/**
 * GET /payments/callback?reference=...
 * Paystack redirects users back to this URL after they complete the checkout.
 * The endpoint verifies the transaction, creates/updates a Payment record,
 * and links it to the corresponding Ticket (identified by the ticket's
 * `paymentReference` field).
 */
router.get('/callback', async (req, res) => {
  const { reference } = req.query as { reference?: string };

  if (!reference) {
    return res.status(400).json({ error: 'Missing payment reference' });
  }

  try {
    const verification = await PaymentService.verifyTransaction(reference);

    if (!verification.success) {
      logger.warn(`Payment verification failed for reference ${reference}`);
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { paymentReference: reference },
      include: { event: true },
    });

    if (!ticket) {
      logger.warn(`No ticket found for payment reference ${reference}`);
      return res.status(404).json({ error: 'Ticket not found for this payment' });
    }

    await prisma.payment.upsert({
      where: { reference },
      update: {
        status: 'SUCCESS',
        amount: verification.amount,
        ticketId: ticket.id,
      },
      create: {
        reference,
        status: 'SUCCESS',
        amount: verification.amount,
        currency: 'NGN',
        eventeeId: ticket.eventeeId,
        eventId: ticket.eventId,
        ticketId: ticket.id,
      },
    });

    await CacheService.delete(`analytics:event:${ticket.eventId}`);
    await CacheService.delete(`analytics:creator:${ticket.event.creatorId}`);

    return res.json({
      message: 'Payment verified successfully',
      ticketId: ticket.id,
    });
  } catch (err) {
    logger.error('Error handling payment callback', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/mock-checkout', async (req, res) => {
  const { reference } = req.query as { reference?: string };

  if (!reference) {
    return res.status(400).json({ error: 'Missing payment reference' });
  }

  return res.redirect(`/payments/callback?reference=${encodeURIComponent(reference)}`);
});

router.get('/creator/me', authenticate, requireRole('CREATOR'), async (req: AuthRequest, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        event: {
          creatorId: req.user!.userId,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        event: true,
        eventee: true,
      },
    });

    const totalPayments = payments.length;
    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

    return res.json({
      totalPayments,
      totalRevenue,
      payments,
    });
  } catch (err) {
    logger.error('Fetch creator payments error', err);
    return res.status(500).json({ error: 'Failed to fetch creator payments' });
  }
});

export default router;

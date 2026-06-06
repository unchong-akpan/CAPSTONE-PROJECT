import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { PaymentService } from '../src/services/payment.service';
import { QRCodeService } from '../src/services/qrcode.service';
import { EmailService } from '../src/services/email.service';

jest.mock('../src/config/db', () => ({
  prisma: {
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    ticket: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/services/payment.service', () => ({
  PaymentService: {
    initializeTransaction: jest.fn(),
  },
}));

jest.mock('../src/services/qrcode.service', () => ({
  QRCodeService: {
    generateVerificationToken: jest.fn(),
    generateQRCode: jest.fn(),
  },
}));

jest.mock('../src/services/email.service', () => ({
  EmailService: {
    sendTicketEmail: jest.fn(),
  },
}));

describe('Ticket purchase', () => {
  const secret = 'test-secret';
  const eventeeToken = jwt.sign({ userId: 'user-1', role: 'EVENTEE' }, secret);

  const event = {
    id: 'ev1',
    title: 'Concert',
    location: 'Venue',
    date: new Date().toISOString(),
    price: 5000,
    availableTickets: 10,
  };

  const user = { id: 'user-1', email: 'user@example.com', name: 'User' };

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
  });

  beforeEach(() => {
    // @ts-ignore
    prisma.event.findUnique.mockResolvedValue(event);
    // @ts-ignore
    prisma.user.findUnique.mockResolvedValue(user);
    // @ts-ignore
    PaymentService.initializeTransaction.mockResolvedValue({
      authorization_url: 'https://paystack.com/pay/mock',
      reference: 'ref123',
      access_code: 'ac123',
    });
    // @ts-ignore
    QRCodeService.generateVerificationToken.mockReturnValue('verif-token');
    // @ts-ignore
    QRCodeService.generateQRCode.mockResolvedValue('data:image/png;base64,mocked');
    // @ts-ignore
    EmailService.sendTicketEmail.mockResolvedValue(true);
    // @ts-ignore
    prisma.ticket.create.mockResolvedValue({ id: 'ticket-1', paymentReference: 'ref123' });
    // @ts-ignore
    prisma.event.update.mockResolvedValue({});
  });

  it('purchases a ticket and returns payment URL', async () => {
    const res = await request(app)
      .post('/tickets/events/ev1/purchase')
      .set('Authorization', `Bearer ${eventeeToken}`)
      .send({})
      .expect(200);
    expect(res.body).toHaveProperty('ticketId', 'ticket-1');
    expect(res.body).toHaveProperty('paymentUrl', 'https://paystack.com/pay/mock');
    expect(PaymentService.initializeTransaction).toHaveBeenCalled();
    expect(EmailService.sendTicketEmail).toHaveBeenCalled();
  });
});

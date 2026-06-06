import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { prisma } from '../src/config/db';

jest.mock('../src/config/db', () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('Events routes', () => {
  const secret = 'test-secret';
  const creatorToken = jwt.sign({ userId: 'creator-1', role: 'CREATOR' }, secret);
  const eventeeToken = jwt.sign({ userId: 'user-1', role: 'EVENTEE' }, secret);

  beforeAll(() => {
    process.env.JWT_SECRET = secret;
  });

  it('GET /events returns list', async () => {
    // @ts-ignore
    prisma.event.findMany.mockResolvedValue([]);
    const res = await request(app).get('/events').expect(200);
    expect(res.body).toEqual([]);
  });

  it('POST /events creates event for creator role', async () => {
    const fakeEvent = {
      id: 'ev1',
      title: 'Test Event',
      description: '',
      location: '',
      date: new Date().toISOString(),
      price: 0,
      totalCapacity: 100,
      availableTickets: 100,
      creatorReminderInterval: 'NONE',
      creatorId: 'creator-1',
    };
    // @ts-ignore
    prisma.event.create.mockResolvedValue(fakeEvent);
    const res = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({ title: fakeEvent.title, date: fakeEvent.date, totalCapacity: fakeEvent.totalCapacity })
      .expect(201);
    expect(res.body).toMatchObject({ id: fakeEvent.id, title: fakeEvent.title });
  });

  it('POST /events rejects non‑creator role', async () => {
    const res = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${eventeeToken}`)
      .send({ title: 'Bad', date: new Date().toISOString(), totalCapacity: 10 })
      .expect(403);
    expect(res.body).toHaveProperty('error');
  });
});

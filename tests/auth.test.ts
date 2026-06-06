import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { prisma } from '../src/config/db';
import bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/config/db', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

describe('Auth routes', () => {
  const secret = 'test-secret';
  beforeAll(() => {
    process.env.JWT_SECRET = secret;
  });

  beforeEach(() => {
    // @ts-ignore
    bcrypt.compare.mockResolvedValue(true);
  });

  it('register creates a user and returns token', async () => {
    const fakeUser = { id: 'u1', email: 'test@example.com', name: 'Tester', role: 'CREATOR' };
    // @ts-ignore
    prisma.user.create.mockResolvedValue(fakeUser);
    const res = await request(app)
      .post('/auth/register')
      .send({ email: fakeUser.email, password: 'pwd', name: fakeUser.name, role: fakeUser.role })
      .expect(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ id: fakeUser.id, email: fakeUser.email, name: fakeUser.name, role: fakeUser.role });
    const payload = jwt.verify(res.body.token, secret) as any;
    expect(payload.userId).toBe(fakeUser.id);
    expect(payload.role).toBe(fakeUser.role);
  });

  it('login with correct credentials returns token', async () => {
    const fakeUser = { id: 'u2', email: 'login@example.com', name: 'Login', password: 'hashedPassword', role: 'EVENTEE' };
    // @ts-ignore
    prisma.user.findUnique.mockResolvedValue(fakeUser);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: fakeUser.email, password: 'pwd' })
      .expect(200);
    expect(res.body).toHaveProperty('token');
    const payload = jwt.verify(res.body.token, secret) as any;
    expect(payload.userId).toBe(fakeUser.id);
    expect(payload.role).toBe(fakeUser.role);
  });
});

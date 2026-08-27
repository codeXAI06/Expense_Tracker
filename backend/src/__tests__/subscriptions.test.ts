import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('expense-tracker-subscriptions'));

  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Subscription User',
    email: 'subs@example.com',
    password: 'StrongPass123!'
  });

  token = registerResponse.body.token;
}, 60000);

afterAll(async () => {
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
}, 60000);

describe('Subscription tracking API', () => {
  it('creates a recurring subscription for the user', async () => {
    const response = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Netflix',
        merchant: 'Netflix',
        amount: 649,
        category: 'Entertainment',
        cadence: 'monthly',
        nextBillingDate: '2026-09-01',
        status: 'active'
      })
      .expect(201);

    expect(response.body.subscription.name).toBe('Netflix');
    expect(response.body.subscription.amount).toBe(649);
    expect(response.body.subscription.cadence).toBe('monthly');
  });

  it('lists subscription summaries for recurring spend', async () => {
    await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Spotify',
        merchant: 'Spotify',
        amount: 299,
        category: 'Entertainment',
        cadence: 'monthly',
        nextBillingDate: '2026-09-05',
        status: 'active'
      });

    const response = await request(app)
      .get('/api/subscriptions/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.activeCount).toBeGreaterThanOrEqual(2);
    expect(response.body.totalMonthlySpend).toBeGreaterThan(0);
    expect(response.body.byCategory).toBeTruthy();
  });

  it('rejects invalid cadence values', async () => {
    const response = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad plan',
        merchant: 'Test',
        amount: 123,
        category: 'Misc',
        cadence: 'yearlyish',
        nextBillingDate: '2026-09-01',
        status: 'active'
      })
      .expect(400);

    expect(response.body.message).toMatch(/cadence|month|week|year/i);
  });
});

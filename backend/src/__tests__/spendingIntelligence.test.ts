import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('expense-tracker-analytics'));

  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Analytics User',
    email: 'analytics@example.com',
    password: 'StrongPass123!'
  });

  token = registerResponse.body.token;

  const seed = [
    { type: 'expense', amount: 1250, description: 'Groceries', category: 'Groceries', paymentMethod: 'Card', merchant: 'FreshMart', date: '2026-08-02T10:00:00.000Z' },
    { type: 'expense', amount: 820, description: 'Lunch', category: 'Food & Dining', paymentMethod: 'UPI', merchant: 'Zomato', date: '2026-08-05T12:00:00.000Z' },
    { type: 'expense', amount: 2500, description: 'Electricity bill', category: 'Utilities', paymentMethod: 'Bank', merchant: 'PowerCo', date: '2026-08-06T08:00:00.000Z' },
    { type: 'expense', amount: 1600, description: 'Streaming', category: 'Entertainment', paymentMethod: 'Card', merchant: 'Netflix', date: '2026-08-10T20:00:00.000Z' },
    { type: 'expense', amount: 430, description: 'Coffee', category: 'Food & Dining', paymentMethod: 'Cash', merchant: 'Starbucks', date: '2026-08-12T07:30:00.000Z' },
    { type: 'income', amount: 75000, description: 'Salary', category: 'Salary', paymentMethod: 'Bank Transfer', merchant: 'Employer', date: '2026-08-01T00:00:00.000Z' }
  ];

  for (const item of seed) {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(item);
  }

  await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${token}`)
    .send({
      type: 'expense',
      amount: 1200,
      description: 'Groceries',
      category: 'Groceries',
      paymentMethod: 'Card',
      merchant: 'FreshMart',
      date: '2026-07-25T10:00:00.000Z'
    });
}, 60000);

afterAll(async () => {
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
}, 60000);

describe('Spending intelligence API', () => {
  it('returns a monthly spending summary with category totals and trend data', async () => {
    const response = await request(app)
      .get('/api/analytics/spending/summary?month=2026-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.totalExpenses).toBeGreaterThan(0);
    expect(response.body.transactionCount).toBeGreaterThanOrEqual(5);
    expect(response.body.byCategory).toBeTruthy();
    expect(response.body.trend).toBeDefined();
    expect(response.body.averageDailySpend).toBeGreaterThan(0);
    expect(response.body.topMerchant).toBeTruthy();
  });

  it('returns helpful spending insights for the month', async () => {
    const response = await request(app)
      .get('/api/analytics/spending/insights?month=2026-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.topCategory).toBeTruthy();
    expect(response.body.biggestExpense).toBeTruthy();
    expect(response.body.insights.length).toBeGreaterThan(0);
    expect(response.body.summary).toMatch(/largest|highest|spending/i);
  });
});

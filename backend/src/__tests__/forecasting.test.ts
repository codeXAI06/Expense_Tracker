import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('expense-tracker-forecasting'));

  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Forecast User',
    email: 'forecast@example.com',
    password: 'StrongPass123!'
  });

  token = registerResponse.body.token;

  const seed = [
    { type: 'income', amount: 60000, description: 'Salary', category: 'Salary', paymentMethod: 'Bank', merchant: 'Employer', date: '2026-07-01T00:00:00.000Z' },
    { type: 'income', amount: 60000, description: 'Salary', category: 'Salary', paymentMethod: 'Bank', merchant: 'Employer', date: '2026-08-01T00:00:00.000Z' },
    { type: 'expense', amount: 1600, description: 'Groceries', category: 'Groceries', paymentMethod: 'Card', merchant: 'FreshMart', date: '2026-07-05T10:00:00.000Z' },
    { type: 'expense', amount: 1750, description: 'Groceries', category: 'Groceries', paymentMethod: 'Card', merchant: 'FreshMart', date: '2026-08-05T10:00:00.000Z' },
    { type: 'expense', amount: 850, description: 'Lunch', category: 'Food & Dining', paymentMethod: 'UPI', merchant: 'Zomato', date: '2026-07-08T12:00:00.000Z' },
    { type: 'expense', amount: 990, description: 'Lunch', category: 'Food & Dining', paymentMethod: 'UPI', merchant: 'Zomato', date: '2026-08-08T12:00:00.000Z' },
    { type: 'expense', amount: 1900, description: 'Utilities', category: 'Utilities', paymentMethod: 'Bank', merchant: 'PowerCo', date: '2026-08-09T08:00:00.000Z' }
  ];

  for (const item of seed) {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(item);
  }
}, 60000);

afterAll(async () => {
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
}, 60000);

describe('Forecasting API', () => {
  it('projects next-month cash flow and burn rate for the user', async () => {
    const response = await request(app)
      .get('/api/forecast?month=2026-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.nextMonthCashFlow).toBeDefined();
    expect(response.body.burnRate).toBeGreaterThan(0);
    expect(response.body.projectedSavings).toBeDefined();
    expect(response.body.recommendedActions.length).toBeGreaterThan(0);
  });

  it('returns a risk summary using the current month trend', async () => {
    const response = await request(app)
      .get('/api/forecast?month=2026-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.riskSummary).toMatch(/stable|watch|risk|tight/i);
    expect(response.body.assumptions.length).toBeGreaterThan(0);
  });
});

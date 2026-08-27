import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('expense-tracker-anomalies'));

  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Anomaly User',
    email: 'anomaly@example.com',
    password: 'StrongPass123!'
  });

  token = registerResponse.body.token;

  const seed = [
    { type: 'expense', amount: 180, description: 'Coffee', category: 'Food & Dining', paymentMethod: 'Card', merchant: 'Starbucks', date: '2026-08-01T08:00:00.000Z' },
    { type: 'expense', amount: 210, description: 'Lunch', category: 'Food & Dining', paymentMethod: 'UPI', merchant: 'Zomato', date: '2026-08-02T13:00:00.000Z' },
    { type: 'expense', amount: 260, description: 'Groceries', category: 'Groceries', paymentMethod: 'Card', merchant: 'FreshMart', date: '2026-08-03T17:00:00.000Z' },
    { type: 'expense', amount: 320, description: 'Groceries', category: 'Groceries', paymentMethod: 'Card', merchant: 'FreshMart', date: '2026-08-04T16:00:00.000Z' },
    { type: 'expense', amount: 2900, description: 'Emergency purchase', category: 'Shopping', paymentMethod: 'Card', merchant: 'Apple Store', date: '2026-08-12T19:00:00.000Z' },
    { type: 'expense', amount: 150, description: 'Taxi', category: 'Transport', paymentMethod: 'UPI', merchant: 'Uber', date: '2026-08-13T18:00:00.000Z' },
    { type: 'income', amount: 60000, description: 'Salary', category: 'Salary', paymentMethod: 'Bank', merchant: 'Employer', date: '2026-08-01T00:00:00.000Z' }
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

describe('Anomaly detection API', () => {
  it('detects unusually large transaction spikes and flags them', async () => {
    const response = await request(app)
      .get('/api/analytics/anomalies?month=2026-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.summary.totalAnomalies).toBeGreaterThan(0);
    expect(response.body.anomalies.length).toBeGreaterThan(0);
    expect(response.body.anomalies[0].type).toMatch(/spike|outlier|merchant|category/i);
    expect(response.body.summary.riskLevel).toMatch(/low|medium|high/i);
  });

  it('returns a clear explanation for each detected anomaly', async () => {
    const response = await request(app)
      .get('/api/analytics/anomalies?month=2026-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.anomalies[0].reason).toBeTruthy();
    expect(response.body.anomalies[0].amount).toBeGreaterThan(0);
    expect(response.body.anomalies[0].merchant).toBeTruthy();
  });
});

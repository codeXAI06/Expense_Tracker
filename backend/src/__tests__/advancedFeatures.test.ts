import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('expense-tracker-advanced'));

  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Advanced User',
    email: 'advanced@example.com',
    password: 'StrongPass123!'
  });

  token = registerResponse.body.token;

  const seed = [
    { type: 'income', amount: 60000, description: 'Salary', category: 'Salary', paymentMethod: 'Bank', merchant: 'Employer', date: '2026-08-01T00:00:00.000Z' },
    { type: 'expense', amount: 1200, description: 'Groceries', category: 'Groceries', paymentMethod: 'Card', merchant: 'FreshMart', date: '2026-08-02T10:00:00.000Z' },
    { type: 'expense', amount: 980, description: 'Lunch', category: 'Food & Dining', paymentMethod: 'UPI', merchant: 'Zomato', date: '2026-08-03T12:30:00.000Z' },
    { type: 'expense', amount: 1600, description: 'Streaming', category: 'Entertainment', paymentMethod: 'Card', merchant: 'Netflix', date: '2026-08-07T20:00:00.000Z' },
    { type: 'expense', amount: 2800, description: 'Emergency purchase', category: 'Shopping', paymentMethod: 'Card', merchant: 'Apple Store', date: '2026-08-12T17:00:00.000Z' },
    { type: 'expense', amount: 720, description: 'Coffee', category: 'Food & Dining', paymentMethod: 'Cash', merchant: 'Starbucks', date: '2026-08-13T08:00:00.000Z' }
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

describe('Advanced financial features', () => {
  it('creates a goal and reports progress', async () => {
    const response = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Emergency fund',
        type: 'savings',
        targetAmount: 10000,
        currentAmount: 4200,
        category: 'Savings',
        dueDate: '2026-12-31'
      })
      .expect(201);

    expect(response.body.goal.name).toBe('Emergency fund');
    expect(response.body.goal.progress).toBeGreaterThan(0);
    expect(response.body.goal.progressPercent).toBeGreaterThan(0);
  });

  it('updates and deletes an owned goal while blocking another user', async () => {
    const created = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Laptop fund',
        type: 'savings',
        targetAmount: 80000,
        currentAmount: 10000,
        category: 'Savings',
        dueDate: '2027-06-30'
      })
      .expect(201);

    const goalId = created.body.goal.id as string;
    await request(app)
      .patch(`/api/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    const otherUser = await request(app).post('/api/auth/register').send({
      name: 'Other User',
      email: 'other-goal@example.com',
      password: 'StrongPass123!'
    });

    await request(app)
      .patch(`/api/goals/${goalId}`)
      .set('Authorization', `Bearer ${otherUser.body.token}`)
      .send({ currentAmount: 50000 })
      .expect(404);

    const updated = await request(app)
      .patch(`/api/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currentAmount: 25000 })
      .expect(200);

    expect(updated.body.goal.currentAmount).toBe(25000);
    expect(updated.body.goal.progressPercent).toBe(31.25);

    await request(app)
      .delete(`/api/goals/${goalId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .then((response) => expect(response.body.goals.some((goal: { id: string }) => goal.id === goalId)).toBe(false));
  });

  it('evaluates what-if scenarios for budget rerouting', async () => {
    const response = await request(app)
      .post('/api/scenarios/what-if')
      .set('Authorization', `Bearer ${token}`)
      .send({
        month: '2026-08',
        category: 'Food & Dining',
        reductionPercent: 20,
        newPriority: 'Emergency Savings'
      })
      .expect(200);

    expect(response.body.estimatedSavings).toBeGreaterThan(0);
    expect(response.body.newCashFlow).toBeDefined();
    expect(response.body.recommendation).toMatch(/food|savings|budget/i);
  });

  it('highlights unusual spending from investigative analysis', async () => {
    const response = await request(app)
      .get('/api/investigations/spending?month=2026-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.findings.length).toBeGreaterThan(0);
    expect(response.body.summary.highRisk).toMatch(/low|medium|high/i);
    expect(response.body.findings[0].merchant).toBeTruthy();
  });

  it('answers a user question with a tailored financial recommendation', async () => {
    const response = await request(app)
      .post('/api/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'How can I reduce my food spending this month?'
      })
      .expect(200);

    expect(response.body.answer).toMatch(/food|budget|spending|reduce/i);
    expect(response.body.recommendations.length).toBeGreaterThan(0);
  });

  it('does not invent answers for unsupported questions', async () => {
    const response = await request(app)
      .post('/api/assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What will the stock market do tomorrow?' })
      .expect(200);

    expect(response.body.answer).toMatch(/not have enough information/i);
    expect(response.body.recommendations).toEqual([]);
  });

  it('builds a monthly financial report with totals and insights', async () => {
    const response = await request(app)
      .get('/api/reports/monthly?month=2026-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.summary.totalExpenses).toBeGreaterThan(0);
    expect(response.body.summary.totalIncome).toBeGreaterThan(0);
    expect(response.body.summary.net).toBeDefined();
    expect(response.body.insights.length).toBeGreaterThan(0);
  });
});

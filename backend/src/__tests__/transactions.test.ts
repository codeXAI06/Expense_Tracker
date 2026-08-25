import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';

let mongoServer: MongoMemoryServer;
let token: string;
let secondToken: string;
let createdTransactionId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('expense-tracker-transactions'));

  await request(app).post('/api/auth/register').send({
    name: 'Alice Budget',
    email: 'alice@example.com',
    password: 'StrongPass123!'
  });

  const loginResponse = await request(app).post('/api/auth/login').send({
    email: 'alice@example.com',
    password: 'StrongPass123!'
  });

  token = loginResponse.body.token;

  await request(app).post('/api/auth/register').send({
    name: 'Bob Budget',
    email: 'bob@example.com',
    password: 'StrongPass456!'
  });

  const bobLogin = await request(app).post('/api/auth/login').send({
    email: 'bob@example.com',
    password: 'StrongPass456!'
  });

  secondToken = bobLogin.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Transaction API', () => {
  it('creates a new transaction with valid input', async () => {
    const response = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 850,
        description: 'Groceries',
        category: 'Food',
        paymentMethod: 'Credit Card',
        merchant: 'FreshMart',
        date: '2026-08-10T09:00:00.000Z'
      })
      .expect(201);

    createdTransactionId = response.body.transaction.id;
    expect(response.body.transaction.amount).toBe(850);
    expect(response.body.transaction.user).toBeTruthy();
  });

  it('lists filtered transactions with pagination', async () => {
    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 320,
        description: 'Coffee and pastries',
        category: 'Food',
        paymentMethod: 'UPI',
        merchant: 'BeanWorks',
        date: '2026-08-13T09:00:00.000Z'
      });

    await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'income',
        amount: 42000,
        description: 'Salary',
        category: 'Salary',
        paymentMethod: 'Bank Transfer',
        merchant: 'Employer',
        date: '2026-08-01T00:00:00.000Z'
      });

    const response = await request(app)
      .get('/api/transactions?type=expense&search=coffee&limit=2&page=1&sort=amount:desc')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.page).toBe(1);
    expect(response.body.total).toBeGreaterThanOrEqual(1);
  });

  it('returns a monthly summary with totals and counts', async () => {
    const response = await request(app)
      .get('/api/transactions/summary?month=2026-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.totalIncome).toBeGreaterThan(0);
    expect(response.body.totalExpenses).toBeGreaterThan(0);
    expect(response.body.net).toBeDefined();
    expect(response.body.transactionCount).toBeGreaterThanOrEqual(3);
  });

  it('updates an owned transaction', async () => {
    const response = await request(app)
      .patch(`/api/transactions/${createdTransactionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 910, category: 'Groceries', description: 'Weekly groceries' })
      .expect(200);

    expect(response.body.transaction.amount).toBe(910);
    expect(response.body.transaction.description).toBe('Weekly groceries');
  });

  it('prevents unauthorized access to another user transaction', async () => {
    const response = await request(app)
      .get(`/api/transactions/${createdTransactionId}`)
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(404);

    expect(response.body.message).toMatch(/not found|access/i);
  });

  it('deletes a transaction', async () => {
    const response = await request(app)
      .delete(`/api/transactions/${createdTransactionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.deleted).toBe(true);
  });
});

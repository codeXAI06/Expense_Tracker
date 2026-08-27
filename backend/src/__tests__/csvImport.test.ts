import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('expense-tracker-imports'));

  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Import User',
    email: 'importer@example.com',
    password: 'StrongPass123!'
  });

  token = registerResponse.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('CSV import API', () => {
  it('accepts a valid CSV and returns a preview with counts', async () => {
    const csv = [
      'Date,Description,Amount,Category,Payment Method,Merchant',
      '2026-08-01,Groceries,1200.50,Food,Card,FreshMart',
      '2026-08-02,Electric bill,2500,Utilities,Bank,PowerCo',
      '2026-08-03,Salary,55000,Salary,Transfer,Employer'
    ].join('\n');

    const response = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csv), {
        filename: 'transactions.csv',
        contentType: 'text/csv'
      })
      .field('mapping', JSON.stringify({
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        category: 'Category',
        paymentMethod: 'Payment Method',
        merchant: 'Merchant'
      }))
      .expect(200);

    expect(response.body.summary.imported).toBeGreaterThan(0);
    expect(response.body.summary.duplicates).toBe(0);
    expect(response.body.rows).toHaveLength(3);
  });

  it('rejects malformed CSV files', async () => {
    const response = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('bad,line\nmissing,columns'), {
        filename: 'broken.csv',
        contentType: 'text/csv'
      })
      .field('mapping', JSON.stringify({
        date: 'Date',
        description: 'Description',
        amount: 'Amount'
      }))
      .expect(400);

    expect(response.body.message).toMatch(/missing|required|columns|headers/i);
  });

  it('flags duplicate rows and invalid rows', async () => {
    const csv = [
      'Date,Description,Amount,Category,Payment Method,Merchant',
      '2026-08-10,Coffee,250,Food,UPI,BeanWorks',
      '2026-08-10,Coffee,250,Food,UPI,BeanWorks',
      '2026-08-11,,200,Food,UPI,BeanWorks'
    ].join('\n');

    const response = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csv), {
        filename: 'duplicates.csv',
        contentType: 'text/csv'
      })
      .field('mapping', JSON.stringify({
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        category: 'Category',
        paymentMethod: 'Payment Method',
        merchant: 'Merchant'
      }))
      .expect(200);

    expect(response.body.summary.duplicates).toBeGreaterThanOrEqual(1);
    expect(response.body.summary.invalid).toBeGreaterThanOrEqual(1);
  });

  it('rejects missing required columns', async () => {
    const csv = [
      'Date,Description,Amount',
      '2026-08-01,Groceries,1500'
    ].join('\n');

    const response = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csv), {
        filename: 'missing-columns.csv',
        contentType: 'text/csv'
      })
      .field('mapping', JSON.stringify({
        date: 'Date',
        description: 'Description',
        amount: 'Amount'
      }))
      .expect(400);

    expect(response.body.message).toMatch(/required|missing|columns/i);
  });

  it('rejects oversized CSV files', async () => {
    const bigCsv = 'Date,Description,Amount,Category,Payment Method,Merchant\n' + '2026-08-01,Groceries,1500,Food,Card,FreshMart\n'.repeat(60000);

    const response = await request(app)
      .post('/api/imports/preview')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(bigCsv), {
        filename: 'large.csv',
        contentType: 'text/csv'
      })
      .field('mapping', JSON.stringify({
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        category: 'Category',
        paymentMethod: 'Payment Method',
        merchant: 'Merchant'
      }))
      .expect(413);

    expect(response.body.message).toMatch(/too large|limit|size/i);
  });

  it('requires authentication for imports', async () => {
    const response = await request(app)
      .post('/api/imports/preview')
      .attach('file', Buffer.from('Date,Description,Amount\n2026-08-01,Groceries,1200'), {
        filename: 'unauthorized.csv',
        contentType: 'text/csv'
      })
      .field('mapping', JSON.stringify({
        date: 'Date',
        description: 'Description',
        amount: 'Amount'
      }))
      .expect(401);

    expect(response.body.message).toMatch(/token|authorized|login/i);
  });
});

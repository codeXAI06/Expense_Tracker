import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('expense-tracker-receipts'));

  const registerResponse = await request(app).post('/api/auth/register').send({
    name: 'Receipt User',
    email: 'receipt@example.com',
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

describe('Receipt intelligence API', () => {
  it('extracts merchant, amount, and category from a receipt image', async () => {
    const receiptText = Buffer.from('STARBUCKS\nCOFFEE HOUSE\nTOTAL $18.75\n2026-08-12');

    const response = await request(app)
      .post('/api/receipts/analyze')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', receiptText, {
        filename: 'receipt.png',
        contentType: 'image/png'
      })
      .expect(200);

    expect(response.body.extracted.merchant).toMatch(/starbucks|coffee/i);
    expect(response.body.extracted.amount).toBeGreaterThan(0);
    expect(response.body.extracted.category).toMatch(/food|coffee|beverage/i);
    expect(response.body.extracted.confidence).toBeGreaterThan(0.5);
  });

  it('stores a user confirmation for extracted receipt data', async () => {
    const response = await request(app)
      .post('/api/receipts/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({
        merchant: 'Starbucks',
        amount: 18.75,
        date: '2026-08-12',
        category: 'Food & Dining',
        subcategory: 'Coffee Shops',
        source: 'ocr'
      })
      .expect(201);

    expect(response.body.confirmation.merchant).toBe('Starbucks');
    expect(response.body.confirmation.amount).toBe(18.75);
    expect(response.body.confirmation.category).toBe('Food & Dining');
  });

  it('rejects unsupported file types', async () => {
    const response = await request(app)
      .post('/api/receipts/analyze')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain'
      })
      .expect(400);

    expect(response.body.message).toMatch(/image|receipt|supported/i);
  });

  it('does not invent data when an image cannot be read', async () => {
    const response = await request(app)
      .post('/api/receipts/analyze')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from([0, 1, 2, 3]), {
        filename: 'unreadable.png',
        contentType: 'image/png'
      })
      .expect(422);

    expect(response.body.message).toMatch(/extract|manually|receipt/i);
  });
});

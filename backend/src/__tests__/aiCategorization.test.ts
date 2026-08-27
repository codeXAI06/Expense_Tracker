import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';

let mongoServer: MongoMemoryServer;
let token: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('expense-tracker-ai'));

  const response = await request(app).post('/api/auth/register').send({
    name: 'AI User',
    email: 'aiuser@example.com',
    password: 'StrongPass123!'
  });

  token = response.body.token;
  process.env.AI_PROVIDER = 'mock';
  process.env.AI_API_KEY = 'test-key';
}, 60000);

afterAll(async () => {
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
}, 60000);

describe('AI categorization API', () => {
  it('categorizes a merchant into a category with confidence and reason', async () => {
    const response = await request(app)
      .post('/api/ai/categorize')
      .set('Authorization', `Bearer ${token}`)
      .send({
        merchant: 'Uber Eats',
        description: 'Dinner delivery',
        amount: 620,
        history: [
          { merchant: 'Zomato', category: 'Food & Dining', subcategory: 'Food Delivery' },
          { merchant: 'Swiggy', category: 'Food & Dining', subcategory: 'Food Delivery' }
        ]
      })
      .expect(200);

    expect(response.body.category).toMatch(/Food|Dining/i);
    expect(response.body.subcategory).toMatch(/Food|Delivery/i);
    expect(response.body.confidence).toBeGreaterThan(0.5);
    expect(response.body.reason).toBeTruthy();
  });

  it('falls back to deterministic rules when AI is unavailable', async () => {
    delete process.env.AI_API_KEY;

    const response = await request(app)
      .post('/api/ai/categorize')
      .set('Authorization', `Bearer ${token}`)
      .send({
        merchant: 'Netflix',
        description: 'Monthly subscription',
        amount: 649,
        history: []
      })
      .expect(200);

    expect(response.body.source).toMatch(/rule|fallback/i);
    expect(response.body.category).toMatch(/Entertainment|Subscriptions/i);
  });

  it('stores user corrections and uses them in future categorization', async () => {
    const correctionResponse = await request(app)
      .post('/api/ai/correct')
      .set('Authorization', `Bearer ${token}`)
      .send({
        merchant: 'Uber Eats',
        originalCategory: 'Transport',
        correctedCategory: 'Food & Dining',
        correctedSubcategory: 'Food Delivery',
        reason: 'This is restaurant delivery and not travel.'
      })
      .expect(201);

    expect(correctionResponse.body.correction.category).toBe('Food & Dining');

    const response = await request(app)
      .post('/api/ai/categorize')
      .set('Authorization', `Bearer ${token}`)
      .send({
        merchant: 'Uber Eats',
        description: 'Late night order',
        amount: 480,
        history: []
      })
      .expect(200);

    expect(response.body.category).toBe('Food & Dining');
    expect(response.body.reason).toMatch(/previous correction|delivery|food/i);
  });

  it('handles malformed AI provider responses', async () => {
    process.env.AI_PROVIDER = 'broken';

    const response = await request(app)
      .post('/api/ai/categorize')
      .set('Authorization', `Bearer ${token}`)
      .send({
        merchant: 'Zomato',
        description: 'Lunch',
        amount: 340,
        history: []
      })
      .expect(200);

    expect(response.body.category).toBeTruthy();
    expect(response.body.reason).toMatch(/fallback|rule|deterministic/i);
  });
});

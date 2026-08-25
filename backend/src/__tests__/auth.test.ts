import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri('expense-tracker-test'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Authentication API', () => {
  it('registers a user and returns a JWT token', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'StrongPass123!'
      })
      .expect(201);

    expect(response.body.user.email).toBe('ada@example.com');
    expect(response.body.token).toBeTruthy();
  });

  it('logs in an existing user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'StrongPass123!'
      })
      .expect(200);

    expect(response.body.user.email).toBe('ada@example.com');
    expect(response.body.token).toBeTruthy();
  });

  it('rejects invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'bad-password' })
      .expect(401);

    expect(response.body.message).toMatch(/invalid|credentials/i);
  });

  it('returns the current user for authenticated requests', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'ada@example.com',
        password: 'StrongPass123!'
      })
      .expect(200);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.token}`)
      .expect(200);

    expect(response.body.user.email).toBe('ada@example.com');
  });

  it('blocks requests without a token', async () => {
    const response = await request(app).get('/api/auth/me').expect(401);
    expect(response.body.message).toMatch(/token|authorized|login/i);
  });
});

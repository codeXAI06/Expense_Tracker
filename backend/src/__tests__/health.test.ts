import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('Health API', () => {
  it('returns a healthy status payload', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toMatch(/healthy|running/i);
  });
});

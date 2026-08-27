import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('Health API', () => {
  it('returns a healthy status payload', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toMatch(/healthy|running/i);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });
});

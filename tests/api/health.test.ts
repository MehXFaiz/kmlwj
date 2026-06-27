import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../api/index'; // The express app

describe('GET /api/v1/health', () => {
  it('should return a 200 status and health info', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('database', 'connected');
    expect(response.body).toHaveProperty('server', 'running');
  });

  it('should return 405 for POST request', async () => {
    const response = await request(app).post('/api/v1/health');
    expect(response.status).toBe(405);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toBe('Method Not Allowed');
  });
});

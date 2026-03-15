import request from 'supertest';
import app from '../app';

describe('GET /health', () => {
  it('returns 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('returns correct response envelope', async () => {
    const res = await request(app).get('/health');

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message', 'Service is operational.');
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
  });

  it('returns correct health data shape', async () => {
    const res = await request(app).get('/health');

    expect(res.body.data).toHaveProperty('status', 'UP');
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('version');
  });

  it('uptime is a non-negative number', async () => {
    const res = await request(app).get('/health');

    expect(typeof res.body.data.uptime).toBe('number');
    expect(res.body.data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('is accessible without authentication', async () => {
    const res = await request(app).get('/health');

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
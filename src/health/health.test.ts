import request from 'supertest';
import app from '../app';

describe('GET /health', () => {
  it('returns 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('returns correct JSON shape', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('version');
  });

  it('uptime is a non-negative number', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('is accessible without authentication', async () => {
    const res = await request(app).get('/health');
    // No auth header — should still succeed
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

import request from 'supertest';
import app from '../app';

const validBody = {
  buyer: { external_id: 'buyer-ext-1', name: 'Buyer Co' },
  seller: { external_id: 'seller-ext-1', name: 'Seller Co' },
  currency: 'AUD',
  issue_date: '2024-03-01',
  totalAmount: 100,
  lines: [{ description: 'Widget', quantity: 1, unit_price: 100 }],
};

describe('POST /v1/orders/generate', () => {
  it('returns 201 with ubl_xml and orderID', async () => {
    const res = await request(app).post('/v1/orders/generate').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('ubl_xml');
    expect(res.body).toHaveProperty('orderID');
  });

  it('returns 400 when buyer is missing', async () => {
    const { buyer, ...rest } = validBody;
    const res = await request(app).post('/v1/orders/generate').send(rest);
    expect(res.status).toBe(400);
    expect(res.body.details).toContain('buyer is required');
  });

  it('returns 400 when lines is empty', async () => {
    const res = await request(app).post('/v1/orders/generate').send({ ...validBody, lines: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when totalAmount is not a number', async () => {
    const res = await request(app).post('/v1/orders/generate').send({ ...validBody, totalAmount: 'not-a-number' });
    expect(res.status).toBe(400);
  });
});

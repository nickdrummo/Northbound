import request from 'supertest';
import app from '../app';

const validBody = {
  buyer: {
    external_id: 'buyer-ext-1',
    name: 'Buyer Co',
  },
  seller: {
    external_id: 'seller-ext-1',
    name: 'Seller Co',
  },
  currency: 'AUD',
  issue_date: '2024-03-01',
  order_lines: [
    {
      line_id: 'line-1',
      description: 'Widget',
      quantity: 1,
      unit_price: 100,
    },
  ],
};

describe('POST /v1/orders/generate', () => {
  it('returns 201 with ubl_xml and orderID', async () => {
    const res = await request(app).post('/v1/orders/generate').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('UBL order generated successfully');
    expect(res.body.data).toHaveProperty('ubl_xml');
    expect(res.body.data).toHaveProperty('orderID');
    expect(res.body.error).toBeNull();
  });

  it('returns 400 when buyer is missing', async () => {
    const { buyer, ...rest } = validBody;
    const res = await request(app).post('/v1/orders/generate').send(rest);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.data).toBeNull();
    expect(res.body.error).not.toBeNull();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'buyer',
        }),
      ])
    );
  });

  it('returns 400 when order_lines is empty', async () => {
    const res = await request(app)
      .post('/v1/orders/generate')
      .send({ ...validBody, order_lines: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'order_lines',
        }),
      ])
    );
  });

  it('returns 400 when line_id is missing', async () => {
    const res = await request(app).post('/v1/orders/generate').send({
      ...validBody,
      order_lines: [
        {
          description: 'Widget',
          quantity: 1,
          unit_price: 100,
        },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'order_lines[0].line_id',
        }),
      ])
    );
  });
});
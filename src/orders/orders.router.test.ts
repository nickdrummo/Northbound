import request from 'supertest';

// Mock orders.manage so we can force success/error paths without Supabase
const mockListOrders = jest.fn();
const mockRetrieveOrderByID = jest.fn();
const mockRetrieveOrderXML = jest.fn();
const mockStoreOrder = jest.fn();
jest.mock('./orders.manage', () => ({
  listOrders: (...args: unknown[]) => mockListOrders(...args),
  retrieveOrderByID: (...args: unknown[]) => mockRetrieveOrderByID(...args),
  retrieveOrderXML: (...args: unknown[]) => mockRetrieveOrderXML(...args),
  storeOrder: (...args: unknown[]) => mockStoreOrder(...args),
}));

import app from '../app';

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no Supabase env so storeOrder not called; list/retrieve will use mocks when we set them
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
});

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

describe('GET /v1/orders (list)', () => {
  it('returns 200 and list when listOrders succeeds', async () => {
    mockListOrders.mockResolvedValue([{ id: 'o1', currency: 'AUD' }]);
    const res = await request(app).get('/v1/orders');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([{ id: 'o1', currency: 'AUD' }]);
  });

  it('returns 500 when listOrders throws', async () => {
    mockListOrders.mockRejectedValue(new Error('DB connection failed'));
    const res = await request(app).get('/v1/orders');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('LIST_ORDERS_ERROR');
  });
});

describe('GET /v1/orders/:id (JSON)', () => {
  it('returns 500 when Supabase env is not set', async () => {
    const res = await request(app).get('/v1/orders/some-id');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('GET_ORDER_ERROR');
  });

  it('returns 404 when order does not exist', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'key';
    mockRetrieveOrderByID.mockResolvedValue(null);
    const res = await request(app).get('/v1/orders/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 200 and order when order exists', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'key';
    const order = { id: 'ord-1', currency: 'AUD', issue_date: '2025-01-01' };
    mockRetrieveOrderByID.mockResolvedValue(order);
    const res = await request(app).get('/v1/orders/ord-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(order);
  });

  it('returns 500 when retrieveOrderByID throws', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'key';
    mockRetrieveOrderByID.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/v1/orders/some-id');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('GET_ORDER_ERROR');
  });
});

describe('GET /v1/orders/:id/xml', () => {
  it('returns 200 and XML when retrieveOrderXML succeeds', async () => {
    mockRetrieveOrderXML.mockResolvedValue('<Order><ID>o1</ID></Order>');
    const res = await request(app).get('/v1/orders/o1/xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/xml/);
    expect(res.text).toBe('<Order><ID>o1</ID></Order>');
  });

  it('returns 404 when order XML not found', async () => {
    mockRetrieveOrderXML.mockRejectedValue(new Error('Order not found'));
    const res = await request(app).get('/v1/orders/bad-id/xml');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RETRIEVE_ORDER_XML_ERROR');
  });
});

describe('Order lifecycle (501)', () => {
  it('PUT /v1/orders/:id/change returns 501', async () => {
    const res = await request(app).put('/v1/orders/oid/change').send({});
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('ORDER_CHANGE_NOT_IMPLEMENTED');
  });
  it('POST /v1/orders/:id/cancel returns 501', async () => {
    const res = await request(app).post('/v1/orders/oid/cancel').send({});
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('ORDER_CANCEL_NOT_IMPLEMENTED');
  });
  it('POST /v1/orders/:id/response returns 501', async () => {
    const res = await request(app).post('/v1/orders/oid/response').send({});
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('ORDER_RESPONSE_NOT_IMPLEMENTED');
  });
  it('PATCH /v1/orders/:id/detail returns 501', async () => {
    const res = await request(app).patch('/v1/orders/oid/detail').send({});
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe('ORDER_DETAIL_NOT_IMPLEMENTED');
  });
});

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

  it('returns 500 when storeOrder throws (Supabase configured)', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'key';
    mockStoreOrder.mockRejectedValue(new Error('Failed to store order: constraint'));
    const res = await request(app).post('/v1/orders/generate').send(validBody);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('STORE_ORDER_ERROR');
  });
});
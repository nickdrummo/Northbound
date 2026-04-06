import request from 'supertest';

const mockCreateRecurringOrder = jest.fn();
jest.mock('./orders.manage', () => ({
  listOrders: jest.fn(),
  retrieveOrderByID: jest.fn(),
  retrieveOrderXML: jest.fn(),
  storeOrder: jest.fn(),
  createRecurringOrder: (...args: unknown[]) => mockCreateRecurringOrder(...args),
}));

import app from '../app';

beforeEach(() => {
  jest.clearAllMocks();
});

const validRecurringBody = {
  buyer: {
    external_id: 'buyer-ext-1',
    name: 'Buyer Co',
  },
  seller: {
    external_id: 'seller-ext-1',
    name: 'Seller Co',
  },
  currency: 'AUD',
  order_lines: [
    {
      line_id: 'line-1',
      description: 'Widget',
      quantity: 2,
      unit_price: 50,
    },
  ],
  frequency: 'WEEKLY',
  recur_interval: 1,
  recur_start_date: '2026-04-01',
};

const mockRecurringOrder = {
  id: 'recurring-uuid-123',
  buyer_id: 'buyer-uuid',
  seller_id: 'seller-uuid',
  currency: 'AUD',
  order_note: null,
  is_recurring: true,
  frequency: 'WEEKLY',
  recur_interval: 1,
  recur_start_date: '2026-04-01',
  recur_end_date: null,
  created_at: '2026-03-24T00:00:00.000Z',
};

describe('POST /orders/recurring', () => {
  it('returns 201 and recurring order on valid input', async () => {
    mockCreateRecurringOrder.mockResolvedValue(mockRecurringOrder);
    const res = await request(app).post('/orders/recurring').send(validRecurringBody);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_recurring).toBe(true);
    expect(res.body.data.frequency).toBe('WEEKLY');
    expect(mockCreateRecurringOrder).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when frequency is missing', async () => {
    const body = { ...validRecurringBody, frequency: undefined };
    const res = await request(app).post('/orders/recurring').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when frequency is invalid', async () => {
    const body = { ...validRecurringBody, frequency: 'HOURLY' };
    const res = await request(app).post('/orders/recurring').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when recur_interval is not a positive integer', async () => {
    const body = { ...validRecurringBody, recur_interval: 0 };
    const res = await request(app).post('/orders/recurring').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when recur_start_date is missing', async () => {
    const { recur_start_date, ...body } = validRecurringBody;
    const res = await request(app).post('/orders/recurring').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when recur_end_date is before recur_start_date', async () => {
    const body = { ...validRecurringBody, recur_end_date: '2026-01-01' };
    const res = await request(app).post('/orders/recurring').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when buyer is missing', async () => {
    const { buyer, ...body } = validRecurringBody;
    const res = await request(app).post('/orders/recurring').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when order_lines is empty', async () => {
    const body = { ...validRecurringBody, order_lines: [] };
    const res = await request(app).post('/orders/recurring').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when createRecurringOrder throws', async () => {
    mockCreateRecurringOrder.mockRejectedValue(new Error('DB error'));
    const res = await request(app).post('/orders/recurring').send(validRecurringBody);
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CREATE_RECURRING_ORDER_ERROR');
  });

  it('accepts optional recur_end_date', async () => {
    mockCreateRecurringOrder.mockResolvedValue({ ...mockRecurringOrder, recur_end_date: '2027-04-01' });
    const body = { ...validRecurringBody, recur_end_date: '2027-04-01' };
    const res = await request(app).post('/orders/recurring').send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.recur_end_date).toBe('2027-04-01');
  });
});

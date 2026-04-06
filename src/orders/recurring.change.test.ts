import request from 'supertest';

const mockUpdateRecurringOrder = jest.fn();
jest.mock('./orders.manage', () => ({
  listOrders: jest.fn(),
  retrieveOrderByID: jest.fn(),
  retrieveOrderXML: jest.fn(),
  storeOrder: jest.fn(),
  updateRecurringOrder: (...args: unknown[]) => mockUpdateRecurringOrder(...args),
}));

import app from '../app';
import { AppError } from '../errors';

beforeEach(() => {
  jest.clearAllMocks();
});

const mockUpdatedOrder = {
  id: 'recurring-uuid-123',
  buyer_id: 'buyer-uuid',
  seller_id: 'seller-uuid',
  currency: 'AUD',
  order_note: null,
  is_recurring: true,
  frequency: 'MONTHLY',
  recur_interval: 2,
  recur_start_date: '2026-04-01',
  recur_end_date: null,
  created_at: '2026-03-24T00:00:00.000Z',
};

describe('PATCH /orders/recurring/:id', () => {
  it('returns 200 with updated order on valid partial update', async () => {
    mockUpdateRecurringOrder.mockResolvedValue(mockUpdatedOrder);
    const res = await request(app)
      .patch('/orders/recurring/recurring-uuid-123')
      .send({ frequency: 'MONTHLY', recur_interval: 2 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.frequency).toBe('MONTHLY');
    expect(mockUpdateRecurringOrder).toHaveBeenCalledWith('recurring-uuid-123', {
      frequency: 'MONTHLY',
      recur_interval: 2,
    });
  });

  it('returns 200 when updating order_lines', async () => {
    mockUpdateRecurringOrder.mockResolvedValue(mockUpdatedOrder);
    const res = await request(app)
      .patch('/orders/recurring/recurring-uuid-123')
      .send({
        order_lines: [{ line_id: '1', description: 'Widget', quantity: 5, unit_price: 10 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .patch('/orders/recurring/recurring-uuid-123')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when frequency is invalid', async () => {
    const res = await request(app)
      .patch('/orders/recurring/recurring-uuid-123')
      .send({ frequency: 'HOURLY' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when recur_interval is zero', async () => {
    const res = await request(app)
      .patch('/orders/recurring/recurring-uuid-123')
      .send({ recur_interval: 0 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when order_lines is empty array', async () => {
    const res = await request(app)
      .patch('/orders/recurring/recurring-uuid-123')
      .send({ order_lines: [] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when recur_end_date is before recur_start_date', async () => {
    const res = await request(app)
      .patch('/orders/recurring/recurring-uuid-123')
      .send({ recur_start_date: '2026-06-01', recur_end_date: '2026-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when recurring order does not exist', async () => {
    mockUpdateRecurringOrder.mockRejectedValue(
      new AppError('RECURRING_ORDER_NOT_FOUND', 'Recurring order with the given ID does not exist.', 404)
    );
    const res = await request(app)
      .patch('/orders/recurring/nonexistent')
      .send({ frequency: 'WEEKLY' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RECURRING_ORDER_NOT_FOUND');
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockUpdateRecurringOrder.mockRejectedValue(new Error('DB connection lost'));
    const res = await request(app)
      .patch('/orders/recurring/recurring-uuid-123')
      .send({ frequency: 'WEEKLY' });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('UPDATE_RECURRING_ORDER_ERROR');
  });

  it('allows setting recur_end_date to null to clear it', async () => {
    mockUpdateRecurringOrder.mockResolvedValue({ ...mockUpdatedOrder, recur_end_date: null });
    const res = await request(app)
      .patch('/orders/recurring/recurring-uuid-123')
      .send({ recur_end_date: null });
    expect(res.status).toBe(200);
    expect(res.body.data.recur_end_date).toBeNull();
  });
});

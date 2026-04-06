import request from 'supertest';

const mockDeleteRecurringOrder = jest.fn();
jest.mock('./orders.manage', () => ({
  listOrders: jest.fn(),
  retrieveOrderByID: jest.fn(),
  retrieveOrderXML: jest.fn(),
  storeOrder: jest.fn(),
  deleteRecurringOrder: (...args: unknown[]) => mockDeleteRecurringOrder(...args),
}));

import app from '../app';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DELETE /orders/recurring/:id', () => {
  it('returns 200 and orderID on successful delete', async () => {
    mockDeleteRecurringOrder.mockResolvedValue({ orderID: 'recurring-uuid-123' });
    const res = await request(app).delete('/orders/recurring/recurring-uuid-123');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Recurring order deleted successfully');
    expect(res.body.data).toEqual({ orderID: 'recurring-uuid-123' });
    expect(mockDeleteRecurringOrder).toHaveBeenCalledWith('recurring-uuid-123');
  });

  it('returns 404 when recurring order does not exist', async () => {
    mockDeleteRecurringOrder.mockResolvedValue(null);
    const res = await request(app).delete('/orders/recurring/nonexistent-id');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RECURRING_ORDER_NOT_FOUND');
  });

  it('returns 500 when service throws', async () => {
    mockDeleteRecurringOrder.mockRejectedValue(new Error('DB failure'));
    const res = await request(app).delete('/orders/recurring/recurring-uuid-123');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DELETE_RECURRING_ORDER_ERROR');
    expect(res.body.error.message).toBe('DB failure');
  });

  it('returns 500 with unknown error message when non-Error thrown', async () => {
    mockDeleteRecurringOrder.mockRejectedValue('some string error');
    const res = await request(app).delete('/orders/recurring/recurring-uuid-123');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Unknown error');
  });

  it('calls deleteRecurringOrder with correct id param', async () => {
    mockDeleteRecurringOrder.mockResolvedValue({ orderID: 'abc-123' });
    await request(app).delete('/orders/recurring/abc-123');
    expect(mockDeleteRecurringOrder).toHaveBeenCalledTimes(1);
    expect(mockDeleteRecurringOrder).toHaveBeenCalledWith('abc-123');
  });
});

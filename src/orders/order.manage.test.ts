jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

const { createClient } = require('@supabase/supabase-js') as {
    createClient: jest.Mock;
};

import { AppError } from '../errors';

const ordersManage = require('./orders.manage') as typeof import('./orders.manage');
const {
    storeOrder,
    retrieveOrderByID,
    updateOrderWithFullPayload,
    cancelOrder,
} = ordersManage;

// Sample order data to reuse across tests
const testInput = {
    buyer: {
        external_id: 'buyer-ext-1',
        name: 'Buyer Co',
        email: 'buyer@example.com',
        city: 'Sydney',
        country: 'AU',
    },
    seller: {
        external_id: 'seller-ext-1',
        name: 'Seller Co',
        email: 'seller@example.com',
        city: 'Melbourne',
        country: 'AU',
    },
    currency: 'AUD',
    issue_date: '2024-03-01',
    order_lines: [
        { line_id: '1', description: 'Widget A', quantity: 2, unit_price: 50, unit_code: 'EA' },
        { line_id: '2', description: 'Widget B', quantity: 1, unit_price: 100, unit_code: 'EA' },
    ],
};

const testOrderID = 'test-uuid-1234';
const testXml = '<Order>...</Order>';

const mockSingle = jest.fn();
const mockEq     = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockInsert = jest.fn();
const mockSingleId = jest.fn(); // for parties upsert().select('id').single()
const mockSelectId = jest.fn(() => ({ single: mockSingleId }));
const mockUpsert = jest.fn(() => ({ select: mockSelectId }));
const mockEqUpdate = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEqUpdate }));
const mockEqDelete = jest.fn();
const mockDelete = jest.fn(() => ({ eq: mockEqDelete }));
const mockFrom = jest.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
    upsert: mockUpsert,
    update: mockUpdate,
    delete: mockDelete,
}));

beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';
    (createClient as jest.Mock).mockReturnValue({ from: mockFrom });
});

// Tests for storing orders (flow: parties upsert x2, orders insert, order_lines insert)
describe('storeOrder', () => {
    test('throws when Supabase env is not set', async () => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_ANON_KEY;
        await expect(storeOrder(testOrderID, testInput, testXml))
            .rejects.toThrow('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
        process.env.SUPABASE_URL = url;
        process.env.SUPABASE_ANON_KEY = key;
    });

    test('successfully saves a new order', async () => {
        mockSingleId
            .mockResolvedValueOnce({ data: { id: 'buyer-uuid' }, error: null })
            .mockResolvedValueOnce({ data: { id: 'seller-uuid' }, error: null });
        mockInsert.mockResolvedValue({ error: null });
        await expect(
            storeOrder(testOrderID, testInput, testXml)
        ).resolves.not.toThrow();
        expect(mockFrom).toHaveBeenCalledWith('parties');
        expect(mockFrom).toHaveBeenCalledWith('orders');
        expect(mockFrom).toHaveBeenCalledWith('order_lines');
    });

    test('throws an error if database fails', async () => {
        mockSingleId
            .mockResolvedValueOnce({ data: { id: 'buyer-uuid' }, error: null })
            .mockResolvedValueOnce({ data: { id: 'seller-uuid' }, error: null });
        mockInsert
            .mockResolvedValueOnce({ error: { message: 'DB error' } }); // orders insert fails
        await expect(
            storeOrder(testOrderID, testInput, testXml)
        ).rejects.toThrow('Failed to store order: DB error');
    });
});

// Tests for retrieving orders by ID
describe('retrieveOrderByID', () => {
    test('returns order data when order exists', async () => {
        mockSingle.mockResolvedValue({ data: { id: testOrderID }, error: null });
        const result = await retrieveOrderByID(testOrderID);
        expect(result).toEqual({ id: testOrderID });
        expect(mockEq).toHaveBeenCalledWith('id', testOrderID);
    });

    test('returns null when order is not found', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
        const result = await retrieveOrderByID(testOrderID);
        expect(result).toBeNull();
    });

});

describe('updateOrderWithFullPayload', () => {
    it('throws ORDER_NOT_FOUND when order does not exist', async () => {
        // retrieveOrderByID() uses: supabase.from('orders').select('*').eq(...).single()
        // It returns null when `error` is truthy.
        mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

        await expect(
            updateOrderWithFullPayload(testOrderID, testInput)
        ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', status: 404 });
    });

    it('updates parties/orders/lines and returns regenerated UBL XML', async () => {
        mockSingle.mockResolvedValueOnce({ data: { id: testOrderID }, error: null });

        // buyer/seller upserts (each: upsert().select('id').single())
        mockSingleId
            .mockResolvedValueOnce({ data: { id: 'buyer-uuid' }, error: null })
            .mockResolvedValueOnce({ data: { id: 'seller-uuid' }, error: null });

        mockUpdate.mockReturnValue({ eq: mockEqUpdate });
        mockEqUpdate.mockResolvedValue({ error: null });

        mockDelete.mockReturnValue({ eq: mockEqDelete });
        mockEqDelete.mockResolvedValue({ error: null });

        mockInsert.mockResolvedValue({ error: null });

        const result = await updateOrderWithFullPayload(testOrderID, testInput);
        expect(result).toEqual(
            expect.objectContaining({ orderID: testOrderID, ubl_xml: expect.any(String) })
        );
        expect(result.ubl_xml).toContain(testOrderID);
    });
});

describe('cancelOrder', () => {
    it('throws ORDER_NOT_FOUND when order does not exist', async () => {
        // retrieveOrderByID uses supabase.from('orders').select('*').eq('id', ...).single()
        mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

        await expect(cancelOrder(testOrderID)).rejects.toMatchObject({
            code: 'ORDER_NOT_FOUND',
            status: 404,
        });
    });

    it('deletes order_lines then order and returns orderID', async () => {
        // retrieveOrderByID success
        mockSingle.mockResolvedValueOnce({ data: { id: testOrderID }, error: null });

        // order_lines delete().eq(...) -> { error }
        mockEqDelete
            .mockResolvedValueOnce({ error: null })
            // orders delete().eq(...) -> { error }
            .mockResolvedValueOnce({ error: null });

        const result = await cancelOrder(testOrderID);
        expect(result).toEqual({ orderID: testOrderID });
        expect(mockEqDelete).toHaveBeenCalledTimes(2);
    });
});
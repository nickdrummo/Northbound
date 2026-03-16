import { storeOrder, retrieveOrderByID } from './orders.manage';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

// Sample order data to reuse across tests
const testInput = {
    buyer: { external_id: 'buyer-ext-1', name: 'Buyer Co', email: 'buyer@example.com', city: 'Sydney', country: 'AU' },
    seller: { external_id: 'seller-ext-1', name: 'Seller Co', email: 'seller@example.com', city: 'Melbourne', country: 'AU' },
    currency: 'AUD',
    issue_date: '2024-03-01',
    totalAmount: 200,
    order_lines: [
        { line_id: '1', description: 'Widget A', quantity: 2, unit_price: 50, unit_code: 'EA' },
        { line_id: '2', description: 'Widget B', quantity: 1, unit_price: 100, unit_code: 'EA' },
    ],
};

const testOrderID = 'test-uuid-1234';
const testXml = '<Order>...</Order>';

// Fake supabase methods we control
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockInsert = jest.fn();
const mockSingleId = jest.fn(); // for parties upsert().select('id').single()
const mockSelectId = jest.fn(() => ({ single: mockSingleId }));
const mockUpsert = jest.fn(() => ({ select: mockSelectId }));
const mockFrom = jest.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
    upsert: mockUpsert,
}));

// Reset mocks before each test
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
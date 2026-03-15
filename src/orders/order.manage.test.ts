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
const mockFrom = jest.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
}));

// Reset mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue({ from: mockFrom });
});


describe('storeOrder', () => {
    test('successfully saves a new order', async () => {
        mockInsert.mockResolvedValue({ error: null });

        await expect(
            storeOrder(testOrderID, testInput, testXml)
        ).resolves.not.toThrow();

        expect(mockFrom).toHaveBeenCalledWith('orders');
    });

    test('throws an error if database fails', async () => {
        mockInsert.mockResolvedValue({ error: { message: 'DB error' } });

        await expect(
            storeOrder(testOrderID, testInput, testXml)
        ).rejects.toThrow('Failed to store order: DB error');
    });

});

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
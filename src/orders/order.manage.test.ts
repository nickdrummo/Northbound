import { storeOrder, retrieveOrderByID } from './orders.manage';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

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
const mockUpsert = jest.fn(() => ({
    select: jest.fn(() => ({ single: mockSingle })),
}));

const mockFrom = jest.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
    upsert: mockUpsert,
}));

beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue({ from: mockFrom });
});

// storeOrder
describe('storeOrder', () => {
    beforeEach(() => {
        // Default happy path: upsert returns integer party IDs, inserts succeed
        mockSingle
            .mockResolvedValueOnce({ data: { id: 1 }, error: null })  // buyer upsert
            .mockResolvedValueOnce({ data: { id: 2 }, error: null }); // seller upsert
        mockInsert.mockResolvedValue({ error: null });
    });

    test('inserts buyer and seller parties via upsert', async () => {
        await storeOrder(testOrderID, testInput, testXml);
        expect(mockUpsert).toHaveBeenCalledTimes(2);
        expect(mockUpsert).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ external_id: 'buyer-ext-1' }),
            expect.anything()
        );
        expect(mockUpsert).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ external_id: 'seller-ext-1' }),
            expect.anything()
        );
    });

    test('inserts order with integer buyer_id and seller_id (not external_id strings)', async () => {
        await storeOrder(testOrderID, testInput, testXml);
        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({ buyer_id: 1, seller_id: 2 })
        );
    });

    test('inserts order with correct total_amount (2×50 + 1×100 = 200)', async () => {
        await storeOrder(testOrderID, testInput, testXml);
        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({ total_amount: 200 })
        );
    });

    test('inserts order with ubl_xml', async () => {
        await storeOrder(testOrderID, testInput, testXml);
        expect(mockInsert).toHaveBeenCalledWith(
            expect.objectContaining({ ubl_xml: testXml })
        );
    });

    test('inserts order lines after the order row', async () => {
        await storeOrder(testOrderID, testInput, testXml);
        // Second insert call is the lines array
        const secondCall = mockInsert.mock.calls[1][0];
        expect(Array.isArray(secondCall)).toBe(true);
        expect(secondCall).toHaveLength(2);
        expect(secondCall[0]).toMatchObject({ line_id: '1', order_id: testOrderID });
    });

    test('defaults unit_code to EA when not provided', async () => {
        const inputNoUnit = {
            ...testInput,
            order_lines: [{ line_id: 'L1', description: 'Item', quantity: 1, unit_price: 10 }],
        };
        await storeOrder(testOrderID, inputNoUnit, testXml);
        const lines = mockInsert.mock.calls[1][0];
        expect(lines[0].unit_code).toBe('EA');
    });

    test('throws when buyer upsert fails', async () => {
    mockSingle.mockReset(); // clear the beforeEach values first
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'buyer DB error' } });
    await expect(storeOrder(testOrderID, testInput, testXml))
        .rejects.toThrow('Failed to store buyer');
    });

    test('throws when seller upsert fails', async () => {
        mockSingle.mockReset();
        mockSingle
            .mockResolvedValueOnce({ data: { id: 1 }, error: null })
            .mockResolvedValueOnce({ data: null, error: { message: 'seller DB error' } });
        await expect(storeOrder(testOrderID, testInput, testXml))
            .rejects.toThrow('Failed to store seller');
    });

    test('throws when order insert fails', async () => {
        mockInsert.mockReset();
        mockInsert.mockResolvedValueOnce({ error: { message: 'order insert fail' } });
        await expect(storeOrder(testOrderID, testInput, testXml))
            .rejects.toThrow('Failed to store order');
    });

    test('throws when order_lines insert fails', async () => {
        mockInsert.mockReset();
        mockInsert
            .mockResolvedValueOnce({ error: null })
            .mockResolvedValueOnce({ error: { message: 'lines fail' } });
        await expect(storeOrder(testOrderID, testInput, testXml))
            .rejects.toThrow('Failed to store order lines');
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
import { storeOrder, retrieveOrderByID, updateOrderPartyCountry } from './orders.manage';
import { createClient } from '@supabase/supabase-js';
import { generateUBL } from './ubl.service';

jest.mock('@supabase/supabase-js');
jest.mock('./ubl.service', () => ({
    generateUBL: jest.fn(),
}));

const mockedGenerateUBL = generateUBL as jest.Mock;

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
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockInsert = jest.fn();
const mockSingleId = jest.fn();
const mockSelectId = jest.fn(() => ({ single: mockSingleId }));
const mockUpsert = jest.fn(() => ({ select: mockSelectId }));
const mockFrom = jest.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
    upsert: mockUpsert,
}));

beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';
    (createClient as jest.Mock).mockReturnValue({ from: mockFrom });
});

// Tests for storing orders
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
        mockInsert.mockResolvedValueOnce({ error: { message: 'DB error' } });

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

describe('updateOrderPartyCountry', () => {
    const mockOrdersSingle = jest.fn();
    const mockOrdersEq = jest.fn(() => ({ single: mockOrdersSingle }));
    const mockOrdersSelect = jest.fn(() => ({ eq: mockOrdersEq }));

    const mockPartiesSelectSingle = jest.fn();
    const mockPartiesSelectEq = jest.fn(() => ({ single: mockPartiesSelectSingle }));
    const mockPartiesSelect = jest.fn(() => ({ eq: mockPartiesSelectEq }));

    const mockPartiesUpdateEq = jest.fn();
    const mockPartiesUpdate = jest.fn(() => ({ eq: mockPartiesUpdateEq }));

    const mockLinesEq = jest.fn();
    const mockLinesSelect = jest.fn(() => ({ eq: mockLinesEq }));

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'test-key';

        (createClient as jest.Mock).mockReturnValue({
            from: (table: string) => {
                if (table === 'orders') {
                    return { select: mockOrdersSelect };
                }

                if (table === 'parties') {
                    return {
                        select: mockPartiesSelect,
                        update: mockPartiesUpdate,
                    };
                }

                if (table === 'order_lines') {
                    return { select: mockLinesSelect };
                }

                throw new Error(`Unexpected table: ${table}`);
            },
        });

        mockedGenerateUBL.mockReturnValue({
            orderID: testOrderID,
            ubl_xml: '<Order>updated</Order>',
        });
    });

    test('returns null when order does not exist', async () => {
        mockOrdersSingle.mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
        });

        const result = await updateOrderPartyCountry(testOrderID, 'buyer', 'CN');

        expect(result).toBeNull();
        expect(mockOrdersEq).toHaveBeenCalledWith('id', testOrderID);
    });

    test('updates buyer country and regenerates xml successfully', async () => {
        mockOrdersSingle.mockResolvedValue({
            data: {
                id: testOrderID,
                buyer_id: 'buyer-uuid',
                seller_id: 'seller-uuid',
                currency: 'AUD',
                issue_date: '2024-03-01',
                order_note: 'Test note',
            },
            error: null,
        });

        mockPartiesUpdateEq.mockResolvedValue({ error: null });

        mockPartiesSelectSingle
            .mockResolvedValueOnce({
                data: {
                    external_id: 'buyer-ext-1',
                    name: 'Buyer Co',
                    email: 'buyer@example.com',
                    street: '1 Buyer St',
                    city: 'Sydney',
                    country: 'CN',
                    postal_code: '2000',
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    external_id: 'seller-ext-1',
                    name: 'Seller Co',
                    email: 'seller@example.com',
                    street: '2 Seller St',
                    city: 'Melbourne',
                    country: 'AU',
                    postal_code: '3000',
                },
                error: null,
            });

        mockLinesEq.mockResolvedValue({
            data: [
                {
                    line_id: '1',
                    description: 'Widget A',
                    quantity: 2,
                    unit_price: 50,
                    unit_code: 'EA',
                },
                {
                    line_id: '2',
                    description: 'Widget B',
                    quantity: 1,
                    unit_price: 100,
                    unit_code: 'EA',
                },
            ],
            error: null,
        });

        const result = await updateOrderPartyCountry(testOrderID, 'buyer', 'CN');

        expect(mockPartiesUpdate).toHaveBeenCalledWith({ country: 'CN' });
        expect(mockPartiesUpdateEq).toHaveBeenCalledWith('id', 'buyer-uuid');

        expect(mockedGenerateUBL).toHaveBeenCalledWith(
            {
                buyer: {
                    external_id: 'buyer-ext-1',
                    name: 'Buyer Co',
                    email: 'buyer@example.com',
                    street: '1 Buyer St',
                    city: 'Sydney',
                    country: 'CN',
                    postal_code: '2000',
                },
                seller: {
                    external_id: 'seller-ext-1',
                    name: 'Seller Co',
                    email: 'seller@example.com',
                    street: '2 Seller St',
                    city: 'Melbourne',
                    country: 'AU',
                    postal_code: '3000',
                },
                currency: 'AUD',
                issue_date: '2024-03-01',
                order_note: 'Test note',
                order_lines: [
                    {
                        line_id: '1',
                        description: 'Widget A',
                        quantity: 2,
                        unit_price: 50,
                        unit_code: 'EA',
                    },
                    {
                        line_id: '2',
                        description: 'Widget B',
                        quantity: 1,
                        unit_price: 100,
                        unit_code: 'EA',
                    },
                ],
            },
            testOrderID
        );

        expect(result).toEqual({
            orderID: testOrderID,
            role: 'buyer',
            country: 'CN',
            currency: 'AUD',
            issue_date: '2024-03-01',
            order_note: 'Test note',
            buyer: {
                external_id: 'buyer-ext-1',
                name: 'Buyer Co',
                email: 'buyer@example.com',
                street: '1 Buyer St',
                city: 'Sydney',
                country: 'CN',
                postal_code: '2000',
            },
            seller: {
                external_id: 'seller-ext-1',
                name: 'Seller Co',
                email: 'seller@example.com',
                street: '2 Seller St',
                city: 'Melbourne',
                country: 'AU',
                postal_code: '3000',
            },
            order_lines: [
                {
                    line_id: '1',
                    description: 'Widget A',
                    quantity: 2,
                    unit_price: 50,
                    unit_code: 'EA',
                },
                {
                    line_id: '2',
                    description: 'Widget B',
                    quantity: 1,
                    unit_price: 100,
                    unit_code: 'EA',
                },
            ],
            ubl_xml: '<Order>updated</Order>',
        });
    });

    test('updates seller country using seller_id', async () => {
        mockOrdersSingle.mockResolvedValue({
            data: {
                id: testOrderID,
                buyer_id: 'buyer-uuid',
                seller_id: 'seller-uuid',
                currency: 'AUD',
                issue_date: '2024-03-01',
                order_note: undefined,
            },
            error: null,
        });

        mockPartiesUpdateEq.mockResolvedValue({ error: null });

        mockPartiesSelectSingle
            .mockResolvedValueOnce({
                data: {
                    external_id: 'buyer-ext-1',
                    name: 'Buyer Co',
                    email: 'buyer@example.com',
                    street: undefined,
                    city: 'Sydney',
                    country: 'AU',
                    postal_code: undefined,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    external_id: 'seller-ext-1',
                    name: 'Seller Co',
                    email: 'seller@example.com',
                    street: undefined,
                    city: 'Melbourne',
                    country: 'US',
                    postal_code: undefined,
                },
                error: null,
            });

        mockLinesEq.mockResolvedValue({
            data: [],
            error: null,
        });

        await updateOrderPartyCountry(testOrderID, 'seller', 'US');

        expect(mockPartiesUpdate).toHaveBeenCalledWith({ country: 'US' });
        expect(mockPartiesUpdateEq).toHaveBeenCalledWith('id', 'seller-uuid');
    });

    test('throws when updating party country fails', async () => {
        mockOrdersSingle.mockResolvedValue({
            data: {
                id: testOrderID,
                buyer_id: 'buyer-uuid',
                seller_id: 'seller-uuid',
                currency: 'AUD',
                issue_date: '2024-03-01',
                order_note: 'Test note',
            },
            error: null,
        });

        mockPartiesUpdateEq.mockResolvedValue({
            error: { message: 'DB update failed' },
        });

        await expect(
            updateOrderPartyCountry(testOrderID, 'buyer', 'CN')
        ).rejects.toThrow('Failed to update buyer country: DB update failed');
    });
});
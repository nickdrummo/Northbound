import {
  storeOrder,
  retrieveOrderByID,
  updateOrderPartyCountry,
  updateOrderWithFullPayload,
  cancelOrder,
  patchOrderDetail,
  generateOrderResponseForOrder,
  getPartyInsightsSession,
} from './orders.manage';
import { createClient } from '@supabase/supabase-js';
import { generateUBL } from './ubl.service';

jest.mock('@supabase/supabase-js');
jest.mock('./ubl.service', () => {
  const actual = jest.requireActual<typeof import('./ubl.service')>('./ubl.service');
  return {
    ...actual,
    generateUBL: jest.fn(),
  };
});

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

    mockedGenerateUBL.mockReturnValue({
        orderID: testOrderID,
        ubl_xml: `<Order>${testOrderID}</Order>`,
    });
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

describe('updateOrderWithFullPayload', () => {
    it('throws ORDER_NOT_FOUND when order does not exist', async () => {
        mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

        await expect(
            updateOrderWithFullPayload(testOrderID, testInput)
        ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', status: 404 });
    });

    it('updates parties/orders/lines and returns regenerated UBL XML', async () => {
        mockSingle.mockResolvedValueOnce({ data: { id: testOrderID }, error: null });

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
        mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

        await expect(cancelOrder(testOrderID)).rejects.toMatchObject({
            code: 'ORDER_NOT_FOUND',
            status: 404,
        });
    });

    it('deletes order_lines then order and returns orderID', async () => {
        mockSingle.mockResolvedValueOnce({ data: { id: testOrderID }, error: null });

        mockEqDelete
            .mockResolvedValueOnce({ error: null })
            .mockResolvedValueOnce({ error: null });

        const result = await cancelOrder(testOrderID);
        expect(result).toEqual({ orderID: testOrderID });
        expect(mockEqDelete).toHaveBeenCalledTimes(2);
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
            ubl_xml: `<Order>${testOrderID}</Order>`,
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
            ubl_xml: `<Order>${testOrderID}</Order>`,
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

describe('getPartyInsightsSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';
  });

  it('returns null when party not found', async () => {
    (createClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'parties') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    });

    await expect(getPartyInsightsSession('missing', 'buyer')).resolves.toBeNull();
  });

  it('attaches counterparty details to each order', async () => {
    const buyerPartyRow = {
      id: 'party-buyer-uuid',
      external_id: 'buyer-ext-1',
      name: 'Buyer Co',
      email: 'buyer@example.com',
      street: null,
      city: 'Sydney',
      country: 'AU',
      postal_code: null,
    };

    const sellerPartyRow = {
      id: 'party-seller-uuid',
      external_id: 'seller-ext-1',
      name: 'Seller Co',
      email: 'seller@example.com',
      country: 'AU',
    };

    const orderRows = [
      {
        id: 'order-1',
        buyer_id: 'party-buyer-uuid',
        seller_id: 'party-seller-uuid',
        currency: 'AUD',
        issue_date: '2024-03-01',
        order_note: null,
        is_recurring: false,
      },
    ];

    const lines = [
      {
        order_id: 'order-1',
        line_id: '1',
        description: 'Widget A',
        quantity: 2,
        unit_price: 50,
        unit_code: 'EA',
      },
    ];

    (createClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'parties') {
          return {
            select: () => ({
              eq: (col: string, value: string) => ({
                single: async () => {
                  if (col === 'external_id' && value === 'buyer-ext-1') {
                    return { data: buyerPartyRow, error: null };
                  }
                  return { data: null, error: { message: 'Not found' } };
                },
              }),
              in: async (col: string, ids: string[]) => {
                if (col === 'id' && ids.includes('party-seller-uuid')) {
                  return { data: [sellerPartyRow], error: null };
                }
                return { data: [], error: null };
              },
            }),
          };
        }

        if (table === 'orders') {
          return {
            select: () => ({
              eq: (col: string, value: string) => ({
                order: async () => {
                  if (col === 'buyer_id' && value === 'party-buyer-uuid') {
                    return { data: orderRows, error: null };
                  }
                  return { data: [], error: null };
                },
              }),
            }),
          };
        }

        if (table === 'order_lines') {
          return {
            select: () => ({
              in: async (col: string, ids: string[]) => {
                if (col === 'order_id' && ids.includes('order-1')) {
                  return { data: lines, error: null };
                }
                return { data: [], error: null };
              },
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });

    const result = await getPartyInsightsSession('buyer-ext-1', 'buyer');
    expect(result).not.toBeNull();
    expect(result?.orders[0]).toMatchObject({
      order_id: 'order-1',
      currency: 'AUD',
      counterparty: {
        external_id: 'seller-ext-1',
        name: 'Seller Co',
        email: 'seller@example.com',
      },
    });
    expect(result?.orders[0].order_lines).toHaveLength(1);
  });
});

describe('patchOrderDetail', () => {
    const mockOrdersSingle = jest.fn();
    const mockOrdersEq = jest.fn(() => ({ single: mockOrdersSingle }));
    const mockOrdersSelect = jest.fn(() => ({ eq: mockOrdersEq }));

    const mockOrdersUpdateEq = jest.fn();
    const mockOrdersUpdate = jest.fn(() => ({ eq: mockOrdersUpdateEq }));

    const mockPartiesSelectSingle = jest.fn();
    const mockPartiesSelectEq = jest.fn(() => ({ single: mockPartiesSelectSingle }));
    const mockPartiesSelect = jest.fn(() => ({ eq: mockPartiesSelectEq }));

    const mockLinesEq = jest.fn();
    const mockLinesSelect = jest.fn(() => ({ eq: mockLinesEq }));

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'test-key';

        (createClient as jest.Mock).mockReturnValue({
            from: (table: string) => {
                if (table === 'orders') {
                    return {
                        select: mockOrdersSelect,
                        update: mockOrdersUpdate,
                    };
                }
                if (table === 'parties') {
                    return { select: mockPartiesSelect };
                }
                if (table === 'order_lines') {
                    return { select: mockLinesSelect };
                }
                throw new Error(`Unexpected table: ${table}`);
            },
        });

        mockedGenerateUBL.mockReturnValue({
            orderID: testOrderID,
            ubl_xml: `<Order>${testOrderID}</Order>`,
        });
    });

    test('returns null when order does not exist', async () => {
        mockOrdersSingle.mockResolvedValueOnce({
            data: null,
            error: { message: 'Not found' },
        });

        const result = await patchOrderDetail(testOrderID, { currency: 'USD' });
        expect(result).toBeNull();
    });

    test('throws when order is recurring', async () => {
        mockOrdersSingle.mockResolvedValueOnce({
            data: {
                id: testOrderID,
                is_recurring: true,
                buyer_id: 'b',
                seller_id: 's',
            },
            error: null,
        });

        await expect(
            patchOrderDetail(testOrderID, { currency: 'USD' })
        ).rejects.toMatchObject({ code: 'USE_RECURRING_PATCH', status: 400 });
    });

    test('updates currency and returns regenerated UBL', async () => {
        mockOrdersSingle
            .mockResolvedValueOnce({
                data: {
                    id: testOrderID,
                    buyer_id: 'buyer-uuid',
                    seller_id: 'seller-uuid',
                    currency: 'AUD',
                    issue_date: '2024-03-01',
                    order_note: 'Note',
                    is_recurring: false,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    id: testOrderID,
                    buyer_id: 'buyer-uuid',
                    seller_id: 'seller-uuid',
                    currency: 'USD',
                    issue_date: '2024-03-01',
                    order_note: 'Note',
                    is_recurring: false,
                },
                error: null,
            });

        mockOrdersUpdateEq.mockResolvedValue({ error: null });

        mockPartiesSelectSingle
            .mockResolvedValueOnce({
                data: {
                    external_id: 'buyer-ext-1',
                    name: 'Buyer Co',
                    email: null,
                    street: null,
                    city: 'Sydney',
                    country: 'AU',
                    postal_code: null,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    external_id: 'seller-ext-1',
                    name: 'Seller Co',
                    email: null,
                    street: null,
                    city: 'Melbourne',
                    country: 'AU',
                    postal_code: null,
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
            ],
            error: null,
        });

        const result = await patchOrderDetail(testOrderID, { currency: 'USD' });

        expect(mockOrdersUpdate).toHaveBeenCalledWith({ currency: 'USD' });
        expect(result).toEqual({
            orderID: testOrderID,
            currency: 'USD',
            issue_date: '2024-03-01',
            order_note: 'Note',
            ubl_xml: `<Order>${testOrderID}</Order>`,
        });
    });
});

describe('generateOrderResponseForOrder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'test-key';
        (createClient as jest.Mock).mockReturnValue({ from: mockFrom });
    });

    test('returns null when order does not exist', async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

        const result = await generateOrderResponseForOrder('missing-id', {
            response_code: 'ACCEPTED',
        });

        expect(result).toBeNull();
    });

    test('returns OrderResponse UBL when order exists', async () => {
        mockSingle.mockResolvedValue({ data: { id: testOrderID }, error: null });

        const result = await generateOrderResponseForOrder(testOrderID, {
            response_code: 'ACCEPTED',
            issue_date: '2024-06-01',
            note: 'Confirmed',
        });

        expect(result?.orderID).toBe(testOrderID);
        expect(result?.responseID).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
        expect(result?.ubl_xml).toContain('OrderResponse');
        expect(result?.ubl_xml).toContain(testOrderID);
        expect(result?.ubl_xml).toContain('ACCEPTED');
        expect(result?.ubl_xml).toContain('2024-06-01');
    });
});
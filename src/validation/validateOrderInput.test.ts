import { validateOrderInput } from './validateOrderInput';

describe('validateOrderInput', () => {
  const validBody = {
    buyer: {
      partyId: 'BUYER-001',
      partyName: 'Example Buyer Pty Ltd',
      countryCode: 'AU',
    },
    seller: {
      partyId: 'SELLER-001',
      partyName: 'Example Seller Pty Ltd',
      countryCode: 'AU',
    },
    currencyCode: 'AUD',
    orderLines: [
      {
        lineNumber: 1,
        itemId: 'SKU-123',
        description: 'Wireless Keyboard',
        quantity: 2,
        unitPrice: 49.99,
      },
    ],
  };

  it('returns no errors for a valid body', () => {
    const errors = validateOrderInput(validBody);
    expect(errors).toEqual([]);
  });

  it('returns an error when body is not an object', () => {
    const errors = validateOrderInput(null);

    expect(errors).toEqual([
      {
        field: 'body',
        message: 'Request body must be a JSON object',
      },
    ]);
  });

  it('returns an error when buyer is missing', () => {
    const invalidBody = {
      ...validBody,
      buyer: undefined,
    };

    const errors = validateOrderInput(invalidBody);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'buyer',
        }),
      ])
    );
  });

  it('returns an error when orderLines is empty', () => {
    const invalidBody = {
      ...validBody,
      orderLines: [],
    };

    const errors = validateOrderInput(invalidBody);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'orderLines',
          message: 'orderLines must contain at least one item',
        }),
      ])
    );
  });

  it('returns an error when quantity is invalid', () => {
    const invalidBody = {
      ...validBody,
      orderLines: [
        {
          ...validBody.orderLines[0],
          quantity: -1,
        },
      ],
    };

    const errors = validateOrderInput(invalidBody);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'orderLines[0].quantity',
        }),
      ])
    );
  });
});
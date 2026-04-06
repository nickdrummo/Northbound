import { describe, expect, it } from '@jest/globals';
import {
  validateOrderInput,
  validateOrderDetailPatch,
  validateOrderResponseInput,
} from './validateOrderInput';

describe('validateOrderInput', () => {
  const validBody = {
    buyer: {
      external_id: 'BUYER-001',
      name: 'Example Buyer Pty Ltd',
      email: 'buyer@example.com',
      street: '123 Market Street',
      city: 'Sydney',
      country: 'AU',
      postal_code: '2000',
    },
    seller: {
      external_id: 'SELLER-001',
      name: 'Example Seller Pty Ltd',
      email: 'seller@example.com',
      street: '456 George Street',
      city: 'Melbourne',
      country: 'AU',
      postal_code: '3000',
    },
    currency: 'AUD',
    issue_date: '2026-03-13',
    order_note: 'Urgent delivery please',
    order_lines: [
      {
        line_id: '1',
        description: 'Wireless Keyboard',
        quantity: 2,
        unit_price: 49.99,
        unit_code: 'EA',
      },
    ],
  };

  it('returns no errors for a valid body', () => {
    const errors = validateOrderInput(validBody);
    expect(errors).toEqual([]);
  });

  it('returns an error when body is not an object', () => {
    const errors = validateOrderInput(undefined);

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

  it('returns an error when buyer.external_id is missing', () => {
    const invalidBody = {
      ...validBody,
      buyer: {
        ...validBody.buyer,
        external_id: '',
      },
    };

    const errors = validateOrderInput(invalidBody);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'buyer.external_id',
        }),
      ])
    );
  });

  it('returns an error when issue_date is invalid', () => {
    const invalidBody = {
      ...validBody,
      issue_date: '13-03-2026',
    };

    const errors = validateOrderInput(invalidBody);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'issue_date',
        }),
      ])
    );
  });

  it('returns an error when order_lines is empty', () => {
    const invalidBody = {
      ...validBody,
      order_lines: [],
    };

    const errors = validateOrderInput(invalidBody);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'order_lines',
          message: 'order_lines must contain at least one item',
        }),
      ])
    );
  });

  it('returns an error when quantity is invalid', () => {
    const invalidBody = {
      ...validBody,
      order_lines: [
        {
          ...validBody.order_lines[0],
          quantity: -1,
        },
      ],
    };

    const errors = validateOrderInput(invalidBody);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'order_lines[0].quantity',
        }),
      ])
    );
  });

  it('returns an error when unit_price is invalid', () => {
    const invalidBody = {
      ...validBody,
      order_lines: [
        {
          ...validBody.order_lines[0],
          unit_price: -10,
        },
      ],
    };

    const errors = validateOrderInput(invalidBody);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'order_lines[0].unit_price',
        }),
      ])
    );
  });
  
  it('returns an error when seller is missing', () => {
  const invalidBody = {
    ...validBody,
    seller: undefined,
  };

  const errors = validateOrderInput(invalidBody);

  expect(errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: 'seller',
      }),
    ])
  );
});
});

describe('validateOrderDetailPatch', () => {
  it('requires at least one known field', () => {
    expect(validateOrderDetailPatch({})).not.toEqual([]);
    expect(validateOrderDetailPatch({ foo: 1 })).not.toEqual([]);
  });

  it('accepts a valid currency patch', () => {
    expect(validateOrderDetailPatch({ currency: 'EUR' })).toEqual([]);
  });

  it('accepts order_note null to clear', () => {
    expect(validateOrderDetailPatch({ order_note: null })).toEqual([]);
  });
});

describe('validateOrderResponseInput', () => {
  it('requires response_code', () => {
    expect(validateOrderResponseInput({})).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'response_code' })])
    );
  });

  it('accepts minimal valid body', () => {
    expect(validateOrderResponseInput({ response_code: 'ACCEPTED' })).toEqual([]);
  });
});
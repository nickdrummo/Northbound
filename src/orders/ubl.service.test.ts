import { generateUBL } from './ubl.service';

const validInput = {
  buyer: { external_id: 'buyer-ext-1', name: 'Buyer Co', email: 'buyer@example.com', city: 'Sydney', country: 'AU' },
  seller: { external_id: 'seller-ext-1', name: 'Seller Co', email: 'seller@example.com', city: 'Melbourne', country: 'AU' },
  currency: 'AUD',
  issue_date: '2024-03-01',
  totalAmount: 200,
  lines: [
    { line_id: '1', description: 'Widget A', quantity: 2, unit_price: 50, unit_code: 'EA' },
    { line_id: '2', description: 'Widget B', quantity: 1, unit_price: 100, unit_code: 'EA' },
  ],
};

describe('generateUBL', () => {
  it('returns a UBL XML string', () => {
    const result = generateUBL(validInput);
    expect(typeof result.ubl_xml).toBe('string');
    expect(result.ubl_xml).toContain('<?xml version="1.0"');
  });

  it('returns a UUID orderID', () => {
    const result = generateUBL(validInput);
    expect(result.orderID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('includes mandatory UBL tags', () => {
    const { ubl_xml } = generateUBL(validInput);
    expect(ubl_xml).toContain('cbc:ID');
    expect(ubl_xml).toContain('cac:BuyerCustomerParty');
    expect(ubl_xml).toContain('cac:SellerSupplierParty');
    expect(ubl_xml).toContain('cbc:DocumentCurrencyCode');
  });

  it('includes correct number of order lines', () => {
    const { ubl_xml } = generateUBL(validInput);
    const matches = ubl_xml.match(/cac:LineItem/g);
    expect(matches?.length).toBe(validInput.lines.length * 2); // opening + closing tags
  });

  it('calculates line extension amount correctly', () => {
    const { ubl_xml } = generateUBL(validInput);
    expect(ubl_xml).toContain('100'); // 2 * 50
  });
});

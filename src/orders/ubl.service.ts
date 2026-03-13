import { XMLBuilder } from 'fast-xml-parser';
import { v4 as uuidv4 } from 'uuid';
import { OrderInput, UBLResult } from './order.types';

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
});

export function generateUBL(input: OrderInput): UBLResult {
  const orderID = uuidv4();

  const ublObject = {
    Order: {
      '@_xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Order-2',
      '@_xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      '@_xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'cbc:UBLVersionID': '2.1',
      'cbc:ID': orderID,
      'cbc:IssueDate': input.issue_date,
      'cbc:DocumentCurrencyCode': input.currency,
      'cbc:Note': input.order_note ?? '',
      'cac:BuyerCustomerParty': buildParty(input.buyer),
      'cac:SellerSupplierParty': buildParty(input.seller),
      'cac:OrderLine': input.lines.map((line, index) => buildOrderLine(line, index)),
      'cbc:TaxInclusiveAmount': {
        '@_currencyID': input.currency,
        '#text': input.totalAmount,
      },
    },
  };

  const ubl_xml = `<?xml version="1.0" encoding="UTF-8"?>\n` + builder.build(ublObject);
  return { orderID, ubl_xml };
}

function buildParty(party: Party) {
  return {
    'cac:Party': {
      'cbc:EndpointID': party.external_id,
      'cac:PartyName': {
        'cbc:Name': party.name,
      },
      'cac:PostalAddress': {
        'cbc:StreetName': party.street ?? '',
        'cbc:CityName': party.city ?? '',
        'cbc:PostalZone': party.postal_code ?? '',
        'cac:Country': {
          'cbc:IdentificationCode': party.country ?? '',
        },
      },
      'cac:Contact': {
        'cbc:ElectronicMail': party.email ?? '',
      },
    },
  };
}

function buildOrderLine(line: OrderLine, index: number) {
  return {
    'cac:LineItem': {
      'cbc:ID': line.line_id ?? String(index + 1),
      'cbc:Quantity': {
        '@_unitCode': line.unit_code ?? 'EA',
        '#text': line.quantity,
      },
      'cbc:LineExtensionAmount': {
        '#text': line.quantity * line.unit_price,
      },
      'cac:Item': {
        'cbc:Description': line.description,
      },
      'cac:Price': {
        'cbc:PriceAmount': line.unit_price,
      },
    },
  };
}

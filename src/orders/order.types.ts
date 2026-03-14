export interface Party {
  external_id: string;
  name: string;
  email?: string;
  street?: string;
  city?: string;
  country?: string;
  postal_code?: string;
}

export interface OrderLine {
  line_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit_code?: string;
}

export interface OrderInput {
  buyer: Party;
  seller: Party;
  currency: string;
  issue_date: string;       // ISO date string e.g. "2024-03-01"
  order_note?: string;
  order_lines: OrderLine[];
  totalAmount: number;
}

export interface UBLResult {
  orderID: string;
  ubl_xml: string;
}

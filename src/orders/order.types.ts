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
  issue_date: string;
  order_note?: string;
  order_lines: OrderLine[];
}

export interface UBLResult {
  orderID: string;
  ubl_xml: string;
}

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';



export interface RecurringOrderInput {
  buyer: Party;
  seller: Party;
  currency: string;
  order_note?: string;
  order_lines: OrderLine[];
  frequency: RecurringFrequency;
  recur_interval: number;
  recur_start_date: string; // ISO date string YYYY-MM-DD
  recur_end_date?: string;  // ISO date string YYYY-MM-DD, optional
}

export interface RecurringOrder {
  id: string;
  buyer_id: string;
  seller_id: string;
  currency: string;
  order_note: string | null;
  is_recurring: true;
  frequency: RecurringFrequency;
  recur_interval: number;
  recur_start_date: string;
  recur_end_date: string | null;
  created_at: string;
}

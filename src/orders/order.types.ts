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
  recur_start_date: string; // ISO date YYYY-MM-DD
  recur_end_date?: string;  // ISO date YYYY-MM-DD, optional
}

export interface RecurringOrderUpdate {
  buyer?: Party;
  seller?: Party;
  currency?: string;
  order_note?: string;
  order_lines?: OrderLine[];
  frequency?: RecurringFrequency;
  recur_interval?: number;
  recur_start_date?: string;
  recur_end_date?: string | null;
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

/** Partial update for `PATCH /orders/:id/detail` (non-recurring orders only). */
export interface OrderDetailPatch {
  currency?: string;
  issue_date?: string;
  order_note?: string | null;
}

/** Body for `POST /orders/:id/response` (UBL OrderResponse). */
export interface OrderResponseInput {
  response_code: string;
  issue_date?: string;
  note?: string;
}

export interface PartyOrderSummary {
  order_id: string;
  currency: string;
  issue_date: string;
  order_note: string | null;
  order_value: number;
  line_count: number;
}

export interface CurrencyBreakdown {
  order_count: number;
  total_value: number;
}

export interface PartyReport {
  party: Party;
  role: 'buyer' | 'seller';
  order_count: number;
  total_value: number;
  avg_order_value: number;
  currencies: Record<string, CurrencyBreakdown>;
  first_order_date: string | null;
  last_order_date: string | null;
  orders: PartyOrderSummary[];
}

export interface PartySession {
  party: Party;
  role: 'buyer' | 'seller';
  orders: Array<{
    order_id: string;
    currency: string;
    issue_date: string;
    order_note: string | null;
    is_recurring: boolean;
    order_lines: OrderLine[];
  }>;
}

export interface CounterpartySummary {
  external_id: string;
  name: string;
  email?: string;
  country?: string;
}

export interface PartyInsightsSession {
  party: Party;
  role: 'buyer' | 'seller';
  orders: Array<{
    order_id: string;
    currency: string;
    issue_date: string;
    order_note: string | null;
    is_recurring: boolean;
    order_lines: OrderLine[];
    counterparty: CounterpartySummary;
  }>;
}

import { OrderLine, Party } from './orders';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** A single order as returned by the /parties endpoint */
export interface PartyOrder {
  order_id: string;
  currency: string;
  issue_date: string;
  order_note: string | null;
  is_recurring: boolean;
  order_lines: OrderLine[];
}

/** Full session for a buyer or seller — list of their orders with lines */
export interface PartySession {
  party: Party;
  role: 'buyer' | 'seller';
  orders: PartyOrder[];
}

export interface CurrencyBreakdown {
  order_count: number;
  total_value: number;
}

export interface PartyOrderSummary {
  order_id: string;
  currency: string;
  issue_date: string;
  order_note: string | null;
  order_value: number;
  line_count: number;
}

/** Aggregated report for a buyer or seller */
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

async function partiesFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ?? err?.message ?? `Request failed: ${res.status}`,
    );
  }
  const json: ApiResponse<T> = await res.json();
  return json.data;
}

export async function fetchSellerOrders(externalId: string): Promise<PartySession | null> {
  return partiesFetch<PartySession>(
    `/parties/sellers/${encodeURIComponent(externalId)}/orders`,
  );
}

export async function fetchBuyerOrders(externalId: string): Promise<PartySession | null> {
  return partiesFetch<PartySession>(
    `/parties/buyers/${encodeURIComponent(externalId)}/orders`,
  );
}

export async function fetchSellerReport(externalId: string): Promise<PartyReport | null> {
  return partiesFetch<PartyReport>(
    `/parties/sellers/${encodeURIComponent(externalId)}/report`,
  );
}

export async function fetchBuyerReport(externalId: string): Promise<PartyReport | null> {
  return partiesFetch<PartyReport>(
    `/parties/buyers/${encodeURIComponent(externalId)}/report`,
  );
}

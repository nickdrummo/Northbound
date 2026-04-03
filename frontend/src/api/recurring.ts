import { Party, OrderLine } from './orders';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RecurringOrderInput {
  buyer: Party;
  seller: Party;
  currency: string;
  order_note?: string;
  order_lines: OrderLine[];
  frequency: RecurringFrequency;
  recur_interval: number;
  recur_start_date: string;
  recur_end_date?: string;
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

interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

export async function createRecurringOrder(input: RecurringOrderInput): Promise<RecurringOrder> {
  const res = await fetch(`${API_URL}/orders/recurring`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.data?.message ?? `Failed to create template: ${res.status}`);
  }
  const json: ApiResponse<RecurringOrder> = await res.json();
  return json.data;
}

export async function updateRecurringOrder(id: string, update: RecurringOrderUpdate): Promise<RecurringOrder> {
  const res = await fetch(`${API_URL}/orders/recurring/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.data?.message ?? `Failed to update template: ${res.status}`);
  }
  const json: ApiResponse<RecurringOrder> = await res.json();
  return json.data;
}

export async function deleteRecurringOrder(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/orders/recurring/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.data?.message ?? `Failed to delete template: ${res.status}`);
  }
}

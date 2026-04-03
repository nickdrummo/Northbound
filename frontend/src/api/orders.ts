const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

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

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  currency: string;
  issue_date: string;
  order_note: string | null;
  is_recurring: boolean;
  frequency: string | null;
  recur_interval: number | null;
  recur_start_date: string | null;
  recur_end_date: string | null;
  created_at: string;
}

interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${API_URL}/orders`);
  if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status} ${res.statusText}`);
  const json: ApiResponse<Order[]> = await res.json();
  return json.data;
}

export async function fetchOrder(id: string): Promise<Order> {
  const res = await fetch(`${API_URL}/orders/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch order: ${res.status} ${res.statusText}`);
  const json: ApiResponse<Order> = await res.json();
  return json.data;
}

export async function createOrder(input: OrderInput): Promise<{ orderID: string }> {
  const res = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err?.error?.validationErrors?.map((e: { field: string; message: string }) => e.message).join(', ');
    throw new Error(detail ?? err?.error?.message ?? err?.message ?? `Failed to create order: ${res.status}`);
  }
  const json: ApiResponse<{ orderID: string }> = await res.json();
  return json.data;
}

export async function cancelOrder(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/v2/orders/${id}/cancel`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.data?.message ?? `Failed to cancel order: ${res.status}`);
  }
}

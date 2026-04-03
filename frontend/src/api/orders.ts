const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

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
  if (!res.ok) {
    throw new Error(`Failed to fetch orders: ${res.status} ${res.statusText}`);
  }
  const json: ApiResponse<Order[]> = await res.json();
  return json.data;
}

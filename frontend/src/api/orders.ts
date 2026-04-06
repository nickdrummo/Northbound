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

export interface ParsedOrderLine {
  line_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit_code: string;
}

export interface ParsedOrderDetails {
  buyerName: string;
  sellerName: string;
  order_lines: ParsedOrderLine[];
}

export interface UpdatedPartyData {
  buyer: Party;
  seller: Party;
  order_lines: OrderLine[];
}

interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

// Helper: get text content of first matching element (namespace-safe)
function xmlText(parent: Element | Document, localName: string): string {
  return parent.getElementsByTagNameNS('*', localName)[0]?.textContent?.trim() ?? '';
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

/**
 * Fetch the UBL XML for an order and parse it into structured data:
 * buyer/seller names and all order lines with quantities and prices.
 */
export async function fetchOrderDetails(id: string): Promise<ParsedOrderDetails> {
  const res = await fetch(`${API_URL}/orders/${id}/xml`);
  if (!res.ok) throw new Error(`Failed to fetch order XML: ${res.status}`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');

  // Party names
  const buyerPartyEl = doc.getElementsByTagNameNS('*', 'BuyerCustomerParty')[0] ?? null;
  const sellerPartyEl = doc.getElementsByTagNameNS('*', 'SellerSupplierParty')[0] ?? null;
  const buyerName = buyerPartyEl ? xmlText(buyerPartyEl, 'Name') : '';
  const sellerName = sellerPartyEl ? xmlText(sellerPartyEl, 'Name') : '';

  // Order lines
  const lineItems = Array.from(doc.getElementsByTagNameNS('*', 'LineItem'));
  const order_lines: ParsedOrderLine[] = lineItems.map((li) => {
    const qtyEl = li.getElementsByTagNameNS('*', 'Quantity')[0] ?? null;
    return {
      line_id: xmlText(li, 'ID'),
      description: xmlText(li, 'Description'),
      quantity: Number(qtyEl?.textContent?.trim() ?? 0),
      unit_price: Number(xmlText(li, 'PriceAmount')),
      unit_code: qtyEl?.getAttribute('unitCode') ?? 'EA',
    };
  });

  return { buyerName, sellerName, order_lines };
}

/**
 * Update the country for a buyer or seller on an existing order.
 * Returns the updated buyer and seller Party objects plus the current order lines.
 */
export async function updatePartyCountry(
  orderId: string,
  role: 'buyer' | 'seller',
  country: string,
): Promise<UpdatedPartyData> {
  const res = await fetch(`${API_URL}/orders/${orderId}/party-country`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, country: country.toUpperCase() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? err?.message ?? `Failed to update party country: ${res.status}`);
  }
  const json: ApiResponse<UpdatedPartyData> = await res.json();
  return json.data;
}

export async function cancelOrder(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/v2/orders/${id}/cancel`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.data?.message ?? `Failed to cancel order: ${res.status}`);
  }
}

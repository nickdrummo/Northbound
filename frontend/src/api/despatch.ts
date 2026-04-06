/**
 * Frontend client for the Northbound despatch advice endpoints,
 * which proxy through to the DevEx Category 2 Despatch API.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface CreateDespatchResult {
  success: boolean;
  adviceIds: string[];
}

export interface RetrieveDespatchResult {
  'despatch-advice'?: string;   // UBL DespatchAdvice XML
  'advice-id'?: string;
}

/**
 * POST /orders/:id/despatch
 * Sends the order's UBL XML to DevEx and creates a despatch advice.
 * Returns the advice IDs on success.
 */
export async function createDespatch(orderId: string): Promise<CreateDespatchResult> {
  const res = await fetch(`${API_URL}/orders/${orderId}/despatch`, {
    method: 'POST',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.error?.message ??
      json?.message ??
      `Failed to create despatch advice (${res.status})`;
    throw new Error(msg);
  }
  return {
    success: json?.success === true,
    adviceIds: Array.isArray(json?.adviceIds) ? json.adviceIds : [],
  };
}

/**
 * GET /orders/:id/despatch[?adviceId=<uuid>]
 * Retrieves the despatch advice XML for an order.
 * Pass adviceId to look up by advice UUID (faster); omit to search by order XML.
 */
export async function getDespatch(
  orderId: string,
  adviceId?: string,
): Promise<RetrieveDespatchResult> {
  const url = adviceId
    ? `${API_URL}/orders/${orderId}/despatch?adviceId=${encodeURIComponent(adviceId)}`
    : `${API_URL}/orders/${orderId}/despatch`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.error?.message ??
      json?.message ??
      `Failed to retrieve despatch advice (${res.status})`;
    throw new Error(msg);
  }
  return json as RetrieveDespatchResult;
}

/**
 * GET /orders/despatch/list
 * Lists all despatch advices associated with the team's DevEx API key.
 */
export async function listDespatches(): Promise<unknown> {
  const res = await fetch(`${API_URL}/orders/despatch/list`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.error?.message ??
      json?.message ??
      `Failed to list despatch advices (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

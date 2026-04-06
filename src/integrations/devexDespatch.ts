/**
 * Client for DevEx Category 2 Despatch API.
 * @see https://devex.cloud.tcore.network/api-docs/
 */

const DEFAULT_BASE = 'https://devex.cloud.tcore.network';

export function getDevexConfig(): { baseUrl: string; apiKey: string | undefined } {
  const baseUrl = (process.env.DEVEX_API_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
  const apiKey = process.env.DEVEX_API_KEY;
  return { baseUrl, apiKey };
}

export function requireDevexApiKey(): string {
  const { apiKey } = getDevexConfig();
  if (!apiKey?.trim()) {
    throw new Error('DEVEX_API_KEY is not set');
  }
  return apiKey.trim();
}

/** POST /api/v1/despatch/create — body is raw UBL Order XML. */
export async function devexCreateDespatchFromOrderXml(orderXml: string): Promise<Response> {
  const { baseUrl } = getDevexConfig();
  const apiKey = requireDevexApiKey();
  return fetch(`${baseUrl}/api/v1/despatch/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'Api-Key': apiKey,
    },
    body: orderXml,
  });
}

/** GET /api/v1/despatch/retrieve */
export async function devexRetrieveDespatch(
  searchType: 'advice-id' | 'order',
  query: string
): Promise<Response> {
  const { baseUrl } = getDevexConfig();
  const apiKey = requireDevexApiKey();
  const params = new URLSearchParams({
    'search-type': searchType,
    query,
  });
  return fetch(`${baseUrl}/api/v1/despatch/retrieve?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Api-Key': apiKey,
    },
  });
}

/** GET /api/v1/despatch/list */
export async function devexListDespatches(): Promise<Response> {
  const { baseUrl } = getDevexConfig();
  const apiKey = requireDevexApiKey();
  return fetch(`${baseUrl}/api/v1/despatch/list`, {
    method: 'GET',
    headers: {
      'Api-Key': apiKey,
    },
  });
}

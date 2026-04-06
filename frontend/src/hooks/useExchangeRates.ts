import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'northbound_exchange_rates';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CachedRates {
  timestamp: number;
  rates: Record<string, number>;
}

function loadCached(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedRates;
    if (Date.now() - cached.timestamp < CACHE_TTL) return cached.rates;
  } catch {
    // fall through
  }
  return null;
}

function saveCached(rates: Record<string, number>): void {
  try {
    const payload: CachedRates = { timestamp: Date.now(), rates };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // silently fail
  }
}

/**
 * Fetches live exchange rates (USD-base) from the Open Exchange Rates free tier.
 * Results are cached in localStorage for 1 hour to avoid hammering the API.
 *
 * `convert(amount, from, to)` converts an amount between any two supported currencies.
 */
export function useExchangeRates() {
  const [rates, setRates]   = useState<Record<string, number> | null>(loadCached);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (rates) return; // already loaded from cache
    setLoading(true);
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((r) => r.json())
      .then((data: { result: string; rates: Record<string, number> }) => {
        if (data.result === 'success') {
          setRates(data.rates);
          saveCached(data.rates);
        } else {
          setError('Exchange rate service unavailable');
        }
      })
      .catch(() => setError('Could not fetch exchange rates'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Convert `amount` from currency `from` to currency `to`.
   * Returns the original amount unchanged if rates are not loaded or currencies match.
   */
  const convert = useCallback(
    (amount: number, from: string, to: string): number => {
      if (!rates || from === to) return amount;
      const fromRate = rates[from] ?? 1;
      const toRate   = rates[to]   ?? 1;
      return amount * (toRate / fromRate);
    },
    [rates],
  );

  return { rates, loading, error, convert };
}

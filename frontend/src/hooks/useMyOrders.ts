import { useEffect, useState, useCallback } from 'react';
import { fetchBuyerOrders, fetchSellerOrders } from '../api/parties';
import { Order } from '../api/orders';
import { useAuth } from '../context/AuthContext';

interface UseMyOrdersResult {
  orders: Order[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Returns only the orders belonging to the logged-in user.
 * Fetches from GET /parties/{role}/{externalId}/orders.
 * If the party endpoint returns 404 (no orders yet for this user) an empty
 * list is shown — never falls back to the global order list.
 */
export function useMyOrders(): UseMyOrdersResult {
  const { role, externalId } = useAuth();
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // No externalId yet (shouldn't happen after login, but guard anyway)
    if (!externalId) {
      if (!cancelled) { setOrders([]); setLoading(false); }
      return () => { cancelled = true; };
    }

    const fetcher = role === 'seller' ? fetchSellerOrders : fetchBuyerOrders;

    fetcher(externalId)
      .then((session) => {
        if (cancelled) return;

        // null = 404 from party endpoint — user simply has no orders yet
        if (!session) {
          setOrders([]);
          return;
        }

        // Map PartyOrder → Order so every page can use a single type
        const mapped: Order[] = session.orders.map((o) => ({
          id:               o.order_id,
          buyer_id:         '',
          seller_id:        '',
          currency:         o.currency,
          issue_date:       o.issue_date,
          order_note:       o.order_note,
          is_recurring:     o.is_recurring,
          frequency:        null,
          recur_interval:   null,
          recur_start_date: null,
          recur_end_date:   null,
          created_at:       o.issue_date,
        }));
        setOrders(mapped);
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [externalId, role, tick]);

  return { orders, loading, error, refetch };
}

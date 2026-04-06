import { useEffect, useState, useCallback } from 'react';
import { fetchBuyerOrders, fetchSellerOrders } from '../api/parties';
import { fetchOrders, Order } from '../api/orders';
import { useAuth } from '../context/AuthContext';

interface UseMyOrdersResult {
  orders: Order[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Returns only the orders that belong to the logged-in user.
 *
 * - Buyer with externalId  →  GET /parties/buyers/{externalId}/orders
 * - Seller with externalId →  GET /parties/sellers/{externalId}/orders
 * - No externalId set      →  falls back to GET /orders (all orders)
 *
 * The PartyOrder shape from the party endpoint is mapped into the same
 * Order interface used everywhere else in the app so callers don't need
 * to care about the difference.
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

    // No externalId — user hasn't set up their profile yet, show all orders
    if (!externalId) {
      fetchOrders()
        .then((data) => { if (!cancelled) { setOrders(data); } })
        .catch((err: Error) => { if (!cancelled) setError(err.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }

    const fetcher = role === 'seller' ? fetchSellerOrders : fetchBuyerOrders;

    fetcher(externalId)
      .then((session) => {
        if (cancelled) return;
        if (!session) {
          // 404 from the party endpoint — this user has no orders yet
          setOrders([]);
          return;
        }
        // Map PartyOrder → Order so every page can use a single type
        const mapped: Order[] = session.orders.map((o) => ({
          id:               o.order_id,
          buyer_id:         '',   // not returned by party endpoint
          seller_id:        '',   // not returned by party endpoint
          currency:         o.currency,
          issue_date:       o.issue_date,
          order_note:       o.order_note,
          is_recurring:     o.is_recurring,
          frequency:        null,
          recur_interval:   null,
          recur_start_date: null,
          recur_end_date:   null,
          created_at:       o.issue_date, // approximation — party endpoint omits created_at
        }));
        setOrders(mapped);
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [externalId, role, tick]);

  return { orders, loading, error, refetch };
}

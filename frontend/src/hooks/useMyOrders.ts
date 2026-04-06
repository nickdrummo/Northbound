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
 * Returns orders for the logged-in user.
 *
 * Strategy (in order of preference):
 *  1. If externalId is set → try GET /parties/{role}/{externalId}/orders
 *  2. If that returns 404 (party not found yet) or the user has no externalId
 *     → fall back to GET /orders so the user always sees their data
 *
 * This handles the common case where the user created orders before setting up
 * their profile, or entered a different external_id in the order form.
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

    // No externalId — user hasn't finished profile setup; show all orders
    if (!externalId) {
      fetchOrders()
        .then((data) => { if (!cancelled) setOrders(data); })
        .catch((err: Error) => { if (!cancelled) setError(err.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }

    const fetcher = role === 'seller' ? fetchSellerOrders : fetchBuyerOrders;

    fetcher(externalId)
      .then((session) => {
        if (cancelled) return;

        if (!session) {
          // 404: this externalId has no orders yet, or the user created orders
          // with a different external_id.  Fall back to GET /orders so the user
          // isn't left staring at an empty list.
          return fetchOrders().then((data) => {
            if (!cancelled) setOrders(data);
          });
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

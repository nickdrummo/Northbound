import { useEffect, useState } from 'react';
import { fetchOrder, Order } from '../api/orders';

interface UseOrderResult {
  order: Order | null;
  loading: boolean;
  error: string | null;
}

export function useOrder(id: string): UseOrderResult {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchOrder(id)
      .then((data) => { if (!cancelled) setOrder(data); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  return { order, loading, error };
}

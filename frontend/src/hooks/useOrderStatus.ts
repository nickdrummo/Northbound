import { useState, useCallback } from 'react';

const STATUS_KEY = 'northbound_order_statuses';

export type OrderStatus = 'pending' | 'shipped' | 'delivered';

function loadStatuses(): Record<string, OrderStatus> {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY) ?? '{}') as Record<string, OrderStatus>;
  } catch {
    return {};
  }
}

function saveStatuses(statuses: Record<string, OrderStatus>): void {
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify(statuses));
  } catch {
    // silently fail
  }
}

/** Get the current status for a single order (no React state — for use outside components). */
export function getOrderStatus(orderId: string): OrderStatus {
  return loadStatuses()[orderId] ?? 'pending';
}

/**
 * React hook that provides reactive access to order statuses stored in localStorage.
 * Multiple components can call this hook and they'll share the same in-memory Map
 * (updates are immediate within the same tab).
 */
export function useOrderStatus() {
  const [statuses, setStatuses] = useState<Record<string, OrderStatus>>(loadStatuses);

  const getStatus = useCallback(
    (orderId: string): OrderStatus => statuses[orderId] ?? 'pending',
    [statuses],
  );

  const updateStatus = useCallback((orderId: string, status: OrderStatus) => {
    setStatuses((prev) => {
      const next = { ...prev, [orderId]: status };
      saveStatuses(next);
      return next;
    });
  }, []);

  return { getStatus, updateStatus };
}

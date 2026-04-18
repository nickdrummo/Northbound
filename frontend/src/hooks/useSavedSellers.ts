import { useCallback, useEffect, useState } from 'react';
import { Party } from '../api/orders';

const STORAGE_KEY = 'northbound_saved_sellers';

/**
 * Locally-persisted list of sellers the user has submitted orders with.
 * Keyed by `external_id` so re-using a seller updates the stored entry
 * rather than creating a duplicate.
 */
export interface SavedSeller extends Party {
  /** ms since epoch — used to sort most-recent-first in the dropdown. */
  savedAt: number;
}

function load(): SavedSeller[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s.external_id === 'string' && typeof s.name === 'string');
  } catch {
    return [];
  }
}

function persist(sellers: SavedSeller[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sellers));
  } catch {
    // silently fail
  }
}

export function useSavedSellers() {
  const [sellers, setSellers] = useState<SavedSeller[]>(load);

  // Sync across tabs
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setSellers(load());
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const saveSeller = useCallback((seller: Party) => {
    if (!seller.external_id?.trim() || !seller.name?.trim()) return;
    setSellers((prev) => {
      const next = prev.filter((s) => s.external_id !== seller.external_id);
      next.unshift({ ...seller, savedAt: Date.now() });
      // Cap the list so localStorage doesn't grow without bound.
      const trimmed = next.slice(0, 50);
      persist(trimmed);
      return trimmed;
    });
  }, []);

  const removeSeller = useCallback((externalId: string) => {
    setSellers((prev) => {
      const next = prev.filter((s) => s.external_id !== externalId);
      persist(next);
      return next;
    });
  }, []);

  return { sellers, saveSeller, removeSeller };
}

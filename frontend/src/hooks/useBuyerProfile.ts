import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'northbound_buyer_profile';

/**
 * Locally-saved buyer profile used to pre-fill the buyer section on
 * Create Order and Create Template. The external_id is not stored here
 * — it is always derived from the authenticated user's email.
 */
export interface BuyerProfile {
  name: string;
  email: string;
  street: string;
  city: string;
  country: string;
  postal_code: string;
}

const EMPTY_PROFILE: BuyerProfile = {
  name: '', email: '', street: '', city: '', country: '', postal_code: '',
};

function load(): BuyerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_PROFILE };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_PROFILE, ...parsed };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

function persist(profile: BuyerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // silently fail
  }
}

/** True when the profile has at least a name set — i.e. worth auto-filling from. */
export function hasBuyerProfile(profile: BuyerProfile): boolean {
  return profile.name.trim().length > 0;
}

/** Read the buyer profile outside a React component (e.g. useState initialisers). */
export function loadBuyerProfile(): BuyerProfile {
  return load();
}

export function useBuyerProfile() {
  const [profile, setProfile] = useState<BuyerProfile>(load);

  // Sync across tabs
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setProfile(load());
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateProfile = useCallback((updates: Partial<BuyerProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates };
      persist(next);
      return next;
    });
  }, []);

  const clearProfile = useCallback(() => {
    setProfile({ ...EMPTY_PROFILE });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // silently fail
    }
  }, []);

  return { profile, updateProfile, clearProfile };
}

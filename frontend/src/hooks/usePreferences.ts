import { useState, useCallback } from 'react';

const PREF_KEY = 'northbound_preferences';

export interface Preferences {
  defaultCurrency: string;
}

const DEFAULT_PREFERENCES: Preferences = {
  defaultCurrency: 'AUD',
};

function load(): Preferences {
  try {
    const stored = localStorage.getItem(PREF_KEY);
    if (stored) return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
  } catch {
    // fall through
  }
  return { ...DEFAULT_PREFERENCES };
}

function save(prefs: Preferences): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    // silently fail
  }
}

// Usable outside a component for useState initialisers
export function getDefaultCurrency(): string {
  return load().defaultCurrency;
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(load);

  const updatePreferences = useCallback((updates: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...updates };
      save(next);
      return next;
    });
  }, []);

  return { prefs, updatePreferences };
}

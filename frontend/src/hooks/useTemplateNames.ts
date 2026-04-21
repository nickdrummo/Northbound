import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'northbound_template_names';

/**
 * Locally-persisted mapping of template (recurring order) ID → user-chosen name.
 * The backend does not currently store template names, so we keep them in
 * localStorage and fall back to a shortened ID when no name is saved.
 */
type TemplateNameMap = Record<string, string>;

function load(): TemplateNameMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: TemplateNameMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === 'string' && typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function persist(map: TemplateNameMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // silently fail
  }
}

/** Read a single template's display name outside React (e.g. useState initialisers). */
export function loadTemplateName(id: string): string | undefined {
  return load()[id];
}

/** Short fallback label when no user-provided name has been saved. */
export function shortTemplateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** Returns the saved name for an ID, or a shortened ID fallback. */
export function displayTemplateName(id: string, names: TemplateNameMap): string {
  const saved = names[id]?.trim();
  return saved && saved.length > 0 ? saved : shortTemplateId(id);
}

export function useTemplateNames() {
  const [names, setNames] = useState<TemplateNameMap>(load);

  // Sync across tabs
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setNames(load());
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTemplateName = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    setNames((prev) => {
      const next = { ...prev };
      if (trimmed.length === 0) {
        delete next[id];
      } else {
        next[id] = trimmed;
      }
      persist(next);
      return next;
    });
  }, []);

  const removeTemplateName = useCallback((id: string) => {
    setNames((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      persist(next);
      return next;
    });
  }, []);

  const getName = useCallback(
    (id: string): string => displayTemplateName(id, names),
    [names],
  );

  return { names, getName, setTemplateName, removeTemplateName };
}

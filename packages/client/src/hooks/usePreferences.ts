import { useState, useCallback } from 'react';

export interface Preferences {
  theme: string;
  fontSize: number;
  fontFamily: string;
}

const STORAGE_KEY = 'wt-preferences';

const DEFAULTS: Preferences = {
  theme: 'Tokyo Night',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
};

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(prefs: Preferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(load);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  return { prefs, update };
}

export const FONT_FAMILIES = [
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { label: 'Fira Code', value: "'Fira Code', monospace" },
  { label: 'Cascadia Code', value: "'Cascadia Code', monospace" },
  { label: 'Menlo', value: "'Menlo', monospace" },
  { label: 'Monaco', value: "'Monaco', monospace" },
  { label: 'Consolas', value: "'Consolas', monospace" },
  { label: 'Ubuntu Mono', value: "'Ubuntu Mono', monospace" },
  { label: 'Source Code Pro', value: "'Source Code Pro', monospace" },
];

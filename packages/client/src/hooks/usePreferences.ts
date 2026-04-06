import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';

export interface Preferences {
  theme: string;
  fontSize: number;
  fontFamily: string;
  lastView?: 'dashboard' | 'terminal';
  lastSessionId?: string;
  lastActiveTabIds?: string[];
}

const DEFAULTS: Preferences = {
  theme: 'Tokyo Night',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
};

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get<Preferences>('/api/preferences')
      .then((remote) => {
        setPrefs({ ...DEFAULTS, ...remote });
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      api.put<Preferences>('/api/preferences', next).catch(() => {});
      return next;
    });
  }, []);

  return { prefs, update, loaded };
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

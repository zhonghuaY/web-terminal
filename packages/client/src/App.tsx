import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { usePreferences } from './hooks/usePreferences';
import { api } from './api/client';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import DashboardPage from './pages/DashboardPage';
import TerminalPage from './pages/TerminalPage';

type View = { page: 'dashboard' } | { page: 'terminal'; sessionId: string };

export default function App() {
  const { isAuthenticated, setupRequired, loading, error, login, setup, logout } = useAuth();
  const { prefs, update: updatePrefs, loaded: prefsLoaded } = usePreferences();
  const [view, setView] = useState<View | null>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !prefsLoaded || restoredRef.current) return;
    restoredRef.current = true;

    if (prefs.lastView === 'terminal' && prefs.lastSessionId) {
      api.get<{ id: string; restorable?: boolean }[]>('/api/sessions').then((sessions) => {
        const savedTabIds = prefs.lastActiveTabIds ?? [];
        const restorableIds = savedTabIds.filter((id) => sessions.find((s) => s.id === id && s.restorable !== false));
        const activeId = restorableIds.includes(prefs.lastSessionId!)
          ? prefs.lastSessionId!
          : restorableIds[0];

        if (activeId) {
          setView({ page: 'terminal', sessionId: activeId });
        } else {
          setView({ page: 'dashboard' });
        }
      }).catch(() => {
        setView({ page: 'dashboard' });
      });
    } else {
      setView({ page: 'dashboard' });
    }
  }, [isAuthenticated, prefsLoaded, prefs.lastView, prefs.lastSessionId, prefs.lastActiveTabIds]);

  const handleOpenTerminal = useCallback((sessionId: string) => {
    setView({ page: 'terminal', sessionId });
    updatePrefs({ lastView: 'terminal', lastSessionId: sessionId });
  }, [updatePrefs]);

  const handleBackToDashboard = useCallback(() => {
    setView({ page: 'dashboard' });
    updatePrefs({ lastView: 'dashboard', lastSessionId: undefined });
  }, [updatePrefs]);

  if (loading && setupRequired === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (setupRequired) {
    return <SetupPage onSetup={setup} error={error} />;
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} error={error} />;
  }

  if (!view) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-gray-400">Restoring session...</div>
      </div>
    );
  }

  if (view.page === 'terminal') {
    const token = localStorage.getItem('wt-token') ?? '';
    return (
      <TerminalPage
        initialSessionId={view.sessionId}
        token={token}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  return (
    <DashboardPage
      onOpenTerminal={handleOpenTerminal}
      onLogout={logout}
    />
  );
}

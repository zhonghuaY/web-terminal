import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import DashboardPage from './pages/DashboardPage';
import TerminalPage from './pages/TerminalPage';

type View = { page: 'dashboard' } | { page: 'terminal'; sessionId: string };

export default function App() {
  const { isAuthenticated, setupRequired, loading, error, login, setup, logout } = useAuth();
  const [view, setView] = useState<View>({ page: 'dashboard' });

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

  if (view.page === 'terminal') {
    const token = localStorage.getItem('wt-token') ?? '';
    return (
      <TerminalPage
        initialSessionId={view.sessionId}
        token={token}
        onBackToDashboard={() => setView({ page: 'dashboard' })}
      />
    );
  }

  return (
    <DashboardPage
      onOpenTerminal={(sessionId) => setView({ page: 'terminal', sessionId })}
      onLogout={logout}
    />
  );
}

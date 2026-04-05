import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import DashboardPage from './pages/DashboardPage';

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
    return (
      <div className="flex h-screen flex-col bg-gray-950">
        <header className="flex items-center border-b border-gray-800 px-4 py-2">
          <button
            onClick={() => setView({ page: 'dashboard' })}
            className="mr-4 rounded-md px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ← Dashboard
          </button>
          <span className="text-sm text-gray-400">Session: {view.sessionId.slice(0, 8)}...</span>
        </header>
        <main className="flex flex-1 items-center justify-center">
          <p className="text-gray-400">Terminal component coming in Task 7...</p>
        </main>
      </div>
    );
  }

  return (
    <DashboardPage
      onOpenTerminal={(sessionId) => setView({ page: 'terminal', sessionId })}
      onLogout={logout}
    />
  );
}

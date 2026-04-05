import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';

export default function App() {
  const { isAuthenticated, setupRequired, loading, error, login, setup, logout } = useAuth();

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

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-2">
        <h1 className="text-lg font-semibold text-white">Web Terminal</h1>
        <button
          onClick={logout}
          className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          Sign Out
        </button>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <p className="text-gray-400">Dashboard coming soon...</p>
      </main>
    </div>
  );
}

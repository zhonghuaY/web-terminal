import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import SessionList from '../components/SessionList';
import ConnectionList from '../components/ConnectionList';
import NewSessionDialog from '../components/NewSessionDialog';
import NewConnectionDialog from '../components/NewConnectionDialog';

interface Session {
  id: string;
  type: 'local' | 'ssh';
  name: string;
  createdAt: string;
  lastAccessed: string;
  sshConnectionId?: string;
}

interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  source: string;
}

interface Props {
  onOpenTerminal: (sessionId: string) => void;
  onLogout: () => void;
}

export default function DashboardPage({ onOpenTerminal, onLogout }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [connections, setConnections] = useState<SSHConnection[]>([]);
  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewConnection, setShowNewConnection] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.get<Session[]>('/api/sessions');
      setSessions(data);
    } catch {
      // handle error
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      const data = await api.get<SSHConnection[]>('/api/connections');
      setConnections(data);
    } catch {
      // handle error
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchConnections();
  }, [fetchSessions, fetchConnections]);

  const handleCreateSession = async (type: 'local' | 'ssh', name?: string, sshConnectionId?: string) => {
    const session = await api.post<Session>('/api/sessions', { type, name, sshConnectionId });
    setSessions((prev) => [...prev, session]);
    setShowNewSession(false);
    onOpenTerminal(session.id);
  };

  const handleDeleteSession = async (id: string) => {
    await api.delete(`/api/sessions/${id}`);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCreateConnection = async (conn: { name: string; host: string; port: number; username: string; authMethod: string; keyPath?: string }) => {
    const created = await api.post<SSHConnection>('/api/connections', conn);
    setConnections((prev) => [...prev, created]);
    setShowNewConnection(false);
  };

  const handleDeleteConnection = async (id: string) => {
    await api.delete(`/api/connections/${id}`);
    setConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const handleConnectSSH = async (connectionId: string) => {
    const conn = connections.find((c) => c.id === connectionId);
    const session = await api.post<Session>('/api/sessions', {
      type: 'ssh',
      name: conn?.name ?? 'SSH',
      sshConnectionId: connectionId,
    });
    setSessions((prev) => [...prev, session]);
    onOpenTerminal(session.id);
  };

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
        <h1 className="text-lg font-semibold text-white">Web Terminal</h1>
        <button
          onClick={onLogout}
          className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          Sign Out
        </button>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Sessions</h2>
              <button
                onClick={() => setShowNewSession(true)}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                + New Terminal
              </button>
            </div>
            <SessionList
              sessions={sessions}
              onResume={onOpenTerminal}
              onDelete={handleDeleteSession}
            />
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">SSH Connections</h2>
              <button
                onClick={() => setShowNewConnection(true)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                + Add Connection
              </button>
            </div>
            <ConnectionList
              connections={connections}
              onConnect={handleConnectSSH}
              onDelete={handleDeleteConnection}
            />
          </section>
        </div>
      </main>

      {showNewSession && (
        <NewSessionDialog
          connections={connections}
          onCreate={handleCreateSession}
          onClose={() => setShowNewSession(false)}
        />
      )}

      {showNewConnection && (
        <NewConnectionDialog
          onCreate={handleCreateConnection}
          onClose={() => setShowNewConnection(false)}
        />
      )}
    </div>
  );
}

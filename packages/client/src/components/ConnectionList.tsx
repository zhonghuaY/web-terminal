import { useState } from 'react';

interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  keyPath?: string;
  source: string;
}

interface Props {
  connections: SSHConnection[];
  onConnect: (id: string) => void;
  onEdit: (conn: SSHConnection) => void;
  onDuplicate: (conn: SSHConnection) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
}

const AUTH_LABELS: Record<string, string> = {
  key: 'Key',
  password: 'Password',
  agent: 'Agent',
};

export default function ConnectionList({ connections, onConnect, onEdit, onDuplicate, onDelete, onTest }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});

  if (connections.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-500">
        No SSH connections configured. Add one or configure ~/.ssh/config.
      </div>
    );
  }

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult((prev) => ({ ...prev, [id]: undefined as unknown as { success: boolean; message: string } }));
    onTest(id);
    setTesting(null);
  };

  return (
    <div className="space-y-2">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
        >
          <div className="flex items-center justify-between">
            <div
              className="flex flex-1 cursor-pointer items-center gap-3"
              onClick={() => setExpanded(expanded === conn.id ? null : conn.id)}
            >
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  conn.source === 'ssh-config'
                    ? 'bg-purple-500/10 text-purple-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                {conn.source === 'ssh-config' ? 'config' : 'manual'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{conn.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {conn.username}@{conn.host}:{conn.port}
                </p>
              </div>
              <svg
                className={`h-4 w-4 text-gray-500 transition-transform ${expanded === conn.id ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div className="ml-3 flex gap-2">
              <button
                onClick={() => onConnect(conn.id)}
                className="rounded-md bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
              >
                Connect
              </button>
            </div>
          </div>

          {expanded === conn.id && (
            <div className="mt-3 border-t border-gray-800 pt-3">
              <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Auth: </span>
                  <span className="text-gray-300">{AUTH_LABELS[conn.authMethod] ?? conn.authMethod}</span>
                </div>
                {conn.keyPath && (
                  <div>
                    <span className="text-gray-500">Key: </span>
                    <span className="font-mono text-gray-300">{conn.keyPath}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Source: </span>
                  <span className="text-gray-300">{conn.source === 'ssh-config' ? '~/.ssh/config' : 'Manual'}</span>
                </div>
              </div>

              {testResult[conn.id] && (
                <div className={`mb-3 rounded-md px-3 py-2 text-xs ${
                  testResult[conn.id].success
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {testResult[conn.id].message}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleTest(conn.id)}
                  disabled={testing === conn.id}
                  className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                >
                  {testing === conn.id ? 'Testing...' : 'Test Connection'}
                </button>
                {conn.source === 'manual' && (
                  <button
                    onClick={() => onEdit(conn)}
                    className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => onDuplicate(conn)}
                  className="rounded-md border border-gray-700 px-3 py-1 text-xs text-gray-300 hover:bg-gray-800"
                >
                  Duplicate
                </button>
                {conn.source === 'manual' && (
                  <button
                    onClick={() => onDelete(conn.id)}
                    className="rounded-md px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

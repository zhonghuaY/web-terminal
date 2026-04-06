import { useState } from 'react';

interface Session {
  id: string;
  type: 'local' | 'ssh';
  name: string;
  createdAt?: string;
  lastAccessed: string;
}

interface Props {
  sessions: Session[];
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export default function SessionList({ sessions, onResume, onDelete, onRename }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-500">
        No active sessions. Create one to get started.
      </div>
    );
  }

  const startRename = (session: Session) => {
    setEditing(session.id);
    setEditName(session.name);
  };

  const commitRename = (id: string) => {
    if (editName.trim()) {
      onRename(id, editName.trim());
    }
    setEditing(null);
  };

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                session.type === 'local'
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {session.type}
            </span>
            <div className="min-w-0 flex-1">
              {editing === session.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(session.id);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  autoFocus
                  className="w-full rounded border border-blue-500 bg-gray-800 px-2 py-0.5 text-sm text-white outline-none"
                />
              ) : (
                <p
                  className="cursor-pointer truncate text-sm font-medium text-white hover:text-blue-400"
                  onDoubleClick={() => startRename(session)}
                  title="Double-click to rename"
                >
                  {session.name}
                </p>
              )}
              <p className="text-xs text-gray-500">
                {session.createdAt && (
                  <span>Created {new Date(session.createdAt).toLocaleDateString()} · </span>
                )}
                Last used {new Date(session.lastAccessed).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="ml-3 flex gap-2">
            <button
              onClick={() => startRename(session)}
              className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-800 hover:text-gray-300"
              title="Rename"
            >
              ✏️
            </button>
            <button
              onClick={() => onResume(session.id)}
              className="rounded-md bg-gray-800 px-3 py-1 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Resume
            </button>
            <button
              onClick={() => onDelete(session.id)}
              className="rounded-md px-3 py-1 text-sm text-red-400 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

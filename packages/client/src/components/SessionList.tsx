interface Session {
  id: string;
  type: 'local' | 'ssh';
  name: string;
  lastAccessed: string;
}

interface Props {
  sessions: Session[];
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SessionList({ sessions, onResume, onDelete }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-500">
        No active sessions. Create one to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                session.type === 'local'
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}
            >
              {session.type}
            </span>
            <div>
              <p className="text-sm font-medium text-white">{session.name}</p>
              <p className="text-xs text-gray-500">
                {new Date(session.lastAccessed).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
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

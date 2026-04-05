interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  source: string;
}

interface Props {
  connections: SSHConnection[];
  onConnect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ConnectionList({ connections, onConnect, onDelete }: Props) {
  if (connections.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-500">
        No SSH connections configured. Add one or configure ~/.ssh/config.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                conn.source === 'ssh-config'
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {conn.source === 'ssh-config' ? 'config' : 'manual'}
            </span>
            <div>
              <p className="text-sm font-medium text-white">{conn.name}</p>
              <p className="text-xs text-gray-500">
                {conn.username}@{conn.host}:{conn.port}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onConnect(conn.id)}
              className="rounded-md bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
            >
              Connect
            </button>
            {conn.source === 'manual' && (
              <button
                onClick={() => onDelete(conn.id)}
                className="rounded-md px-3 py-1 text-sm text-red-400 hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

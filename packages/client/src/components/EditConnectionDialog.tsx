import { useState, type FormEvent } from 'react';

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
  connection: SSHConnection;
  onSave: (id: string, conn: {
    name: string;
    host: string;
    port: number;
    username: string;
    authMethod: string;
    keyPath?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export default function EditConnectionDialog({ connection, onSave, onClose }: Props) {
  const [name, setName] = useState(connection.name);
  const [host, setHost] = useState(connection.host);
  const [port, setPort] = useState(String(connection.port));
  const [username, setUsername] = useState(connection.username);
  const [authMethod, setAuthMethod] = useState(connection.authMethod);
  const [keyPath, setKeyPath] = useState(connection.keyPath ?? '~/.ssh/id_rsa');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(connection.id, {
        name,
        host,
        port: parseInt(port, 10),
        username,
        authMethod,
        keyPath: authMethod === 'key' ? keyPath : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-white">Edit Connection</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Connection Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-300">Host</label>
              <input type="text" required value={host} onChange={(e) => setHost(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Port</label>
              <input type="number" value={port} onChange={(e) => setPort(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Username</label>
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Authentication</label>
            <select value={authMethod} onChange={(e) => setAuthMethod(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none">
              <option value="key">SSH Key</option>
              <option value="password">Password</option>
              <option value="agent">SSH Agent</option>
            </select>
          </div>

          {authMethod === 'key' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Key Path</label>
              <input type="text" value={keyPath} onChange={(e) => setKeyPath(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

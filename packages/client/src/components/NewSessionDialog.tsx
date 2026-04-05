import { useState, type FormEvent } from 'react';

interface SSHConnection {
  id: string;
  name: string;
  host: string;
  username: string;
}

interface Props {
  connections: SSHConnection[];
  onCreate: (type: 'local' | 'ssh', name?: string, sshConnectionId?: string) => Promise<void>;
  onClose: () => void;
}

export default function NewSessionDialog({ connections, onCreate, onClose }: Props) {
  const [type, setType] = useState<'local' | 'ssh'>('local');
  const [name, setName] = useState('');
  const [sshConnectionId, setSshConnectionId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreate(type, name || undefined, type === 'ssh' ? sshConnectionId : undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-white">New Session</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('local')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${
                type === 'local'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Local Terminal
            </button>
            <button
              type="button"
              onClick={() => setType('ssh')}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${
                type === 'ssh'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              SSH Connection
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">Session Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {type === 'ssh' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">SSH Connection</label>
              <select
                value={sshConnectionId}
                onChange={(e) => setSshConnectionId(e.target.value)}
                required={type === 'ssh'}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select a connection...</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.username}@{c.host})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

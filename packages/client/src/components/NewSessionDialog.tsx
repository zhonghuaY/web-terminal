import { useState, useEffect, type FormEvent } from 'react';
import type { TmuxSessionInfo } from '@web-terminal/shared';
import { api } from '../api/client';

interface SSHConnection {
  id: string;
  name: string;
  host: string;
  username: string;
}

interface Props {
  connections: SSHConnection[];
  onCreate: (type: 'local' | 'ssh', name?: string, sshConnectionId?: string, tmuxSession?: string, shellMode?: 'shell' | 'tmux') => Promise<void>;
  onClose: () => void;
}

export default function NewSessionDialog({ connections, onCreate, onClose }: Props) {
  const [type, setType] = useState<'local' | 'ssh'>('local');
  const [localMode, setLocalMode] = useState<'new' | 'tmux'>('new');
  const [name, setName] = useState('');
  const [sshConnectionId, setSshConnectionId] = useState('');
  const [tmuxSessions, setTmuxSessions] = useState<TmuxSessionInfo[]>([]);
  const [selectedTmux, setSelectedTmux] = useState('');
  const [tmuxLoading, setTmuxLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (type === 'local') {
      setTmuxLoading(true);
      api.get<TmuxSessionInfo[]>('/api/sessions/tmux-list')
        .then(setTmuxSessions)
        .catch(() => setTmuxSessions([]))
        .finally(() => setTmuxLoading(false));
    }
  }, [type]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const tmux = type === 'local' && localMode === 'tmux' ? selectedTmux : undefined;
      const mode = type === 'local' ? (localMode === 'tmux' ? 'tmux' as const : 'shell' as const) : undefined;
      await onCreate(
        type,
        name || undefined,
        type === 'ssh' ? sshConnectionId : undefined,
        tmux,
        mode,
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
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

          {type === 'local' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setLocalMode('new'); setSelectedTmux(''); }}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  localMode === 'new'
                    ? 'bg-gray-700 text-white ring-1 ring-blue-500'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                New Shell
              </button>
              <button
                type="button"
                onClick={() => setLocalMode('tmux')}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  localMode === 'tmux'
                    ? 'bg-gray-700 text-white ring-1 ring-blue-500'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Attach tmux Session
              </button>
            </div>
          )}

          {type === 'local' && localMode === 'tmux' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">tmux Session</label>
              {tmuxLoading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : tmuxSessions.length === 0 ? (
                <p className="text-sm text-gray-500">No tmux sessions found on this server.</p>
              ) : (
                <select
                  value={selectedTmux}
                  onChange={(e) => setSelectedTmux(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select a tmux session...</option>
                  {tmuxSessions.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} — {s.windows} win{s.windows > 1 ? 's' : ''}{s.attached ? ' (attached)' : ''} · {formatDate(s.created)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

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
              disabled={loading || (type === 'local' && localMode === 'tmux' && !selectedTmux)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : localMode === 'tmux' && type === 'local' ? 'Attach' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

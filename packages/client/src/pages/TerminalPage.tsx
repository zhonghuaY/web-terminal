import { useState, useCallback, useRef, useEffect } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { api } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useIsMobile } from '../hooks/useIsMobile';
import { usePreferences } from '../hooks/usePreferences';
import TerminalComponent from '../components/Terminal';
import TabBar from '../components/TabBar';
import TouchToolbar from '../components/TouchToolbar';
import ReconnectBanner from '../components/ReconnectBanner';
import SettingsPage from './SettingsPage';

interface Session {
  id: string;
  type: 'local' | 'ssh';
  name: string;
}

interface Props {
  initialSessionId: string;
  token: string;
  onBackToDashboard: () => void;
}

export default function TerminalPage({ initialSessionId, token, onBackToDashboard }: Props) {
  const isMobile = useIsMobile();
  const { prefs, update: updatePrefs } = usePreferences();
  const [tabs, setTabs] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState(initialSessionId);
  const [showSettings, setShowSettings] = useState(false);
  const activeTermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    api.get<Session[]>('/api/sessions').then((sessions) => {
      setTabs(sessions);
      if (!sessions.find((s) => s.id === initialSessionId) && sessions.length > 0) {
        setActiveId(sessions[0].id);
      }
    });
  }, [initialSessionId]);

  const handleData = useCallback((data: string) => {
    activeTermRef.current?.write(data);
  }, []);

  const handleStatus = useCallback((_state: string, _message: string) => {}, []);

  const { send, resize, connected, retries, maxRetries, reconnect } = useWebSocket({
    sessionId: activeId,
    token,
    onData: handleData,
    onStatus: handleStatus,
  });

  const handleTermData = useCallback(
    (data: string) => send(data),
    [send],
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => resize(cols, rows),
    [resize],
  );

  const handleSelectTab = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const handleCloseTab = useCallback(
    async (id: string) => {
      await api.delete(`/api/sessions/${id}`);
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (activeId === id && next.length > 0) {
          setActiveId(next[0].id);
        } else if (next.length === 0) {
          onBackToDashboard();
        }
        return next;
      });
    },
    [activeId, onBackToDashboard],
  );

  const handleCreateTab = useCallback(async () => {
    const session = await api.post<Session>('/api/sessions', { type: 'local' });
    setTabs((prev) => [...prev, session]);
    setActiveId(session.id);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <div className="flex items-center">
        <TabBar
          tabs={tabs.map((t) => ({ id: t.id, name: t.name, type: t.type }))}
          activeId={activeId}
          onSelect={handleSelectTab}
          onClose={handleCloseTab}
          onCreate={handleCreateTab}
          onBackToDashboard={onBackToDashboard}
        />
        <button
          onClick={() => setShowSettings(true)}
          className="flex-shrink-0 border-b border-gray-800 px-3 py-2 text-sm text-gray-500 hover:text-white"
          title="Settings"
        >
          ⚙
        </button>
      </div>
      <ReconnectBanner
        connected={connected}
        retries={retries}
        maxRetries={maxRetries}
        onReconnect={reconnect}
      />
      <div className="flex-1 overflow-hidden p-1">
        <TerminalComponent
          key={`${activeId}-${prefs.theme}-${prefs.fontSize}`}
          onData={handleTermData}
          onResize={handleResize}
          termRef={activeTermRef}
          prefs={prefs}
        />
      </div>
      {isMobile && <TouchToolbar onSend={send} />}
      {showSettings && (
        <SettingsPage prefs={prefs} onUpdate={updatePrefs} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

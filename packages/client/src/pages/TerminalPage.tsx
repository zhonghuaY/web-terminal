import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { api } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useIsMobile } from '../hooks/useIsMobile';
import { usePreferences } from '../hooks/usePreferences';
import TerminalComponent from '../components/Terminal';
import MenuBar from '../components/MenuBar';
import TabBar from '../components/TabBar';
import TouchToolbar from '../components/TouchToolbar';
import ReconnectBanner from '../components/ReconnectBanner';

const SettingsPage = lazy(() => import('./SettingsPage'));

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

  const handleRenameTab = useCallback(async (id: string, name: string) => {
    try {
      const updated = await api.patch<Session>(`/api/sessions/${id}`, { name });
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name: updated.name } : t)));
    } catch {
      // rename failed silently
    }
  }, []);

  const activeSession = tabs.find((t) => t.id === activeId);

  const handleNewSSH = useCallback(() => {
    onBackToDashboard();
  }, [onBackToDashboard]);

  const handleShowSettings = useCallback(() => setShowSettings(true), []);
  const handleCloseActiveTab = useCallback(() => {
    if (activeId) handleCloseTab(activeId);
  }, [activeId, handleCloseTab]);

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <MenuBar
        onNewLocal={handleCreateTab}
        onNewSSH={handleNewSSH}
        onBackToDashboard={onBackToDashboard}
        onSettings={handleShowSettings}
        onCloseTab={handleCloseActiveTab}
        onReconnect={reconnect}
        connected={connected}
        sessionName={activeSession?.name ?? ''}
        sessionType={activeSession?.type ?? 'local'}
      />
      <div className="flex items-center">
        <TabBar
          tabs={tabs}
          activeId={activeId}
          onSelect={handleSelectTab}
          onClose={handleCloseTab}
          onCreate={handleCreateTab}
          onBackToDashboard={onBackToDashboard}
          onRename={handleRenameTab}
        />
      </div>
      <ReconnectBanner
        connected={connected}
        retries={retries}
        maxRetries={maxRetries}
        onReconnect={reconnect}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
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
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="text-gray-400">Loading...</div></div>}>
          <SettingsPage prefs={prefs} onUpdate={updatePrefs} onClose={() => setShowSettings(false)} />
        </Suspense>
      )}
    </div>
  );
}

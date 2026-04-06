import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { api } from '../api/client';
import { useIsMobile } from '../hooks/useIsMobile';
import { usePreferences } from '../hooks/usePreferences';
import TerminalTab from '../components/TerminalTab';
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
  const [connectionStates, setConnectionStates] = useState<Record<string, { connected: boolean; retries: number }>>({});

  const activeSendRef = useRef<((data: string) => void) | null>(null);
  const activeReconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api.get<Session[]>('/api/sessions').then((sessions) => {
      setTabs(sessions);
      if (!sessions.find((s) => s.id === initialSessionId) && sessions.length > 0) {
        setActiveId(sessions[0].id);
      }
    });
  }, [initialSessionId]);

  useEffect(() => {
    if (activeId) {
      api.put('/api/preferences', { lastView: 'terminal', lastSessionId: activeId }).catch(() => {});
    }
  }, [activeId]);

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

  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTitleChange = useCallback((sessionId: string, title: string) => {
    if (!title) return;
    setTabs((prev) => {
      const tab = prev.find((t) => t.id === sessionId);
      if (!tab || tab.name === title) return prev;
      return prev.map((t) => (t.id === sessionId ? { ...t, name: title } : t));
    });
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => {
      api.patch(`/api/sessions/${sessionId}`, { name: title }).catch(() => {});
    }, 500);
  }, []);

  const handleConnectionChange = useCallback((sessionId: string, connected: boolean, retries: number) => {
    setConnectionStates((prev) => {
      const existing = prev[sessionId];
      if (existing?.connected === connected && existing?.retries === retries) return prev;
      return { ...prev, [sessionId]: { connected, retries } };
    });
  }, []);

  const activeSession = tabs.find((t) => t.id === activeId);
  const activeConnState = connectionStates[activeId];
  const activeConnected = activeConnState?.connected ?? false;
  const activeRetries = activeConnState?.retries ?? 0;

  const handleNewSSH = useCallback(() => {
    onBackToDashboard();
  }, [onBackToDashboard]);

  const handleShowSettings = useCallback(() => setShowSettings(true), []);
  const handleCloseActiveTab = useCallback(() => {
    if (activeId) handleCloseTab(activeId);
  }, [activeId, handleCloseTab]);

  const handleReconnect = useCallback(() => {
    activeReconnectRef.current?.();
  }, []);

  const handleSendToActive = useCallback((data: string) => {
    activeSendRef.current?.(data);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <MenuBar
        onNewLocal={handleCreateTab}
        onNewSSH={handleNewSSH}
        onBackToDashboard={onBackToDashboard}
        onSettings={handleShowSettings}
        onCloseTab={handleCloseActiveTab}
        onReconnect={handleReconnect}
        connected={activeConnected}
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
        connected={activeConnected}
        retries={activeRetries}
        maxRetries={20}
        onReconnect={handleReconnect}
      />
      <div className="min-h-0 flex-1 overflow-hidden relative">
        {tabs.map((tab) => (
          <TerminalTab
            key={tab.id}
            sessionId={tab.id}
            token={token}
            prefs={prefs}
            visible={tab.id === activeId}
            onTitleChange={handleTitleChange}
            onConnectionChange={handleConnectionChange}
            sendRef={tab.id === activeId ? activeSendRef : undefined}
            reconnectRef={tab.id === activeId ? activeReconnectRef : undefined}
          />
        ))}
      </div>
      {isMobile && <TouchToolbar onSend={handleSendToActive} />}
      {showSettings && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="text-gray-400">Loading...</div></div>}>
          <SettingsPage prefs={prefs} onUpdate={updatePrefs} onClose={() => setShowSettings(false)} />
        </Suspense>
      )}
    </div>
  );
}

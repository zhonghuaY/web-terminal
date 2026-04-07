import { useCallback, useRef, memo, useEffect } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { useWebSocket } from '../hooks/useWebSocket';
import TerminalComponent from './Terminal';
import type { Preferences } from '../hooks/usePreferences';

interface Props {
  sessionId: string;
  token: string;
  prefs: Preferences;
  visible: boolean;
  onTitleChange?: (sessionId: string, title: string) => void;
  onConnectionChange?: (sessionId: string, connected: boolean, retries: number) => void;
  sendRef?: React.MutableRefObject<((data: string) => void) | null>;
  reconnectRef?: React.MutableRefObject<(() => void) | null>;
}

function TerminalTabInner({ sessionId, token, prefs, visible, onTitleChange, onConnectionChange, sendRef, reconnectRef }: Props) {
  const termRef = useRef<XTerm | null>(null);
  const connectedRef = useRef(false);

  const handleData = useCallback((data: string) => {
    termRef.current?.write(data);
  }, []);

  const handleStatus = useCallback((_state: string, _message: string) => {}, []);

  const handleWsTitleChange = useCallback((title: string) => {
    onTitleChange?.(sessionId, title);
  }, [sessionId, onTitleChange]);

  const { send, resize, connected, retries, maxRetries, reconnect } = useWebSocket({
    sessionId,
    token,
    onData: handleData,
    onStatus: handleStatus,
    onTitleChange: handleWsTitleChange,
  });

  connectedRef.current = connected;

  useEffect(() => {
    onConnectionChange?.(sessionId, connected, retries);
  }, [sessionId, connected, retries, onConnectionChange]);

  useEffect(() => {
    if (visible && sendRef) sendRef.current = send;
    if (visible && reconnectRef) reconnectRef.current = reconnect;
  }, [visible, send, reconnect, sendRef, reconnectRef]);

  const handleTermData = useCallback(
    (data: string) => send(data),
    [send],
  );

  const sendCurrentSize = useCallback(() => {
    const t = termRef.current;
    if (t && connectedRef.current) {
      resize(t.cols, t.rows);
    }
  }, [resize]);

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      resize(cols, rows);
    },
    [resize],
  );

  const handleTermTitleChange = useCallback((title: string) => {
    onTitleChange?.(sessionId, title);
  }, [sessionId, onTitleChange]);

  useEffect(() => {
    if (!connected) return;
    sendCurrentSize();
    const t1 = setTimeout(sendCurrentSize, 50);
    const t2 = setTimeout(sendCurrentSize, 200);
    const t3 = setTimeout(sendCurrentSize, 500);
    const t4 = setTimeout(sendCurrentSize, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [connected, sendCurrentSize]);

  useEffect(() => {
    if (visible && termRef.current) {
      requestAnimationFrame(() => {
        termRef.current?.focus();
        sendCurrentSize();
      });
    }
  }, [visible, sendCurrentSize]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        visibility: visible ? 'visible' : 'hidden',
        zIndex: visible ? 1 : 0,
      }}
    >
      <TerminalComponent
        onData={handleTermData}
        onResize={handleResize}
        onTitleChange={handleTermTitleChange}
        termRef={termRef}
        prefs={prefs}
        visible={visible}
      />
    </div>
  );
}

const TerminalTab = memo(TerminalTabInner);
export default TerminalTab;

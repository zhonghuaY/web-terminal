import { useEffect, useRef, useCallback, useState } from 'react';

interface WsMessage {
  type: 'output' | 'status';
  data?: string;
  state?: 'connected' | 'disconnected' | 'error';
  message?: string;
}

interface UseWebSocketOpts {
  sessionId: string;
  token: string;
  onData: (data: string) => void;
  onStatus: (state: string, message: string) => void;
}

export function useWebSocket({ sessionId, token, onData, onStatus }: UseWebSocketOpts) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const maxRetries = 20;
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        if (msg.type === 'output' && msg.data) {
          onData(msg.data);
        } else if (msg.type === 'status') {
          onStatus(msg.state ?? 'unknown', msg.message ?? '');
          if (msg.state === 'connected') setConnected(true);
          if (msg.state === 'disconnected') setConnected(false);
        }
      } catch {
        // Ignore malformed
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      if (retryRef.current < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
        retryRef.current++;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [sessionId, token, onData, onStatus]);

  useEffect(() => {
    connect();
    return () => {
      retryRef.current = maxRetries;
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  }, []);

  return { send, resize, connected, retries: retryRef.current };
}

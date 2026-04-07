import { useEffect, useRef, useCallback, useState } from 'react';

interface WsMessage {
  type: 'output' | 'status' | 'titleChange';
  data?: string;
  state?: 'connected' | 'disconnected' | 'error';
  message?: string;
  title?: string;
}

interface UseWebSocketOpts {
  sessionId: string;
  token: string;
  onData: (data: string) => void;
  onStatus: (state: string, message: string) => void;
  onTitleChange?: (title: string) => void;
  getTermSize?: () => { cols: number; rows: number } | null;
}

const MAX_RETRIES = 20;

export function useWebSocket({ sessionId, token, onData, onStatus, onTitleChange, getTermSize }: UseWebSocketOpts) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [retries, setRetries] = useState(0);
  const generationRef = useRef(0);

  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const onTitleChangeRef = useRef(onTitleChange);
  onTitleChangeRef.current = onTitleChange;
  const getTermSizeRef = useRef(getTermSize);
  getTermSizeRef.current = getTermSize;

  function buildWsUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let url = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
    const size = getTermSizeRef.current?.();
    if (size) {
      url += `&cols=${size.cols}&rows=${size.rows}`;
    }
    return url;
  }

  useEffect(() => {
    const gen = ++generationRef.current;
    retryRef.current = 0;
    setRetries(0);

    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (gen !== generationRef.current) return;

      const ws = new WebSocket(buildWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (gen !== generationRef.current) {
          ws.close();
          return;
        }
        retryRef.current = 0;
        setRetries(0);
        setConnected(true);
      };

      ws.onmessage = (event) => {
        if (gen !== generationRef.current) return;
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          if (msg.type === 'output' && msg.data) {
            onDataRef.current(msg.data);
          } else if (msg.type === 'status') {
            onStatusRef.current(msg.state ?? 'unknown', msg.message ?? '');
            if (msg.state === 'connected') setConnected(true);
            if (msg.state === 'disconnected') setConnected(false);
          } else if (msg.type === 'titleChange' && msg.title) {
            onTitleChangeRef.current?.(msg.title);
          }
        } catch {
          // Ignore malformed
        }
      };

      ws.onclose = () => {
        if (gen !== generationRef.current) return;
        setConnected(false);
        wsRef.current = null;

        if (retryRef.current < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, retryRef.current), 30000);
          retryRef.current++;
          setRetries(retryRef.current);
          retryTimer = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      generationRef.current++;
      if (retryTimer) clearTimeout(retryTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [sessionId, token]);

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

  const reconnect = useCallback(() => {
    retryRef.current = 0;
    setRetries(0);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    const gen = ++generationRef.current;

    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (gen !== generationRef.current) { ws.close(); return; }
      retryRef.current = 0;
      setRetries(0);
      setConnected(true);
    };

    ws.onmessage = (event) => {
      if (gen !== generationRef.current) return;
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        if (msg.type === 'output' && msg.data) {
          onDataRef.current(msg.data);
        } else if (msg.type === 'status') {
          onStatusRef.current(msg.state ?? 'unknown', msg.message ?? '');
          if (msg.state === 'connected') setConnected(true);
          if (msg.state === 'disconnected') setConnected(false);
        } else if (msg.type === 'titleChange' && msg.title) {
          onTitleChangeRef.current?.(msg.title);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      if (gen !== generationRef.current) return;
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => { ws.close(); };
  }, [sessionId, token]);

  return { send, resize, connected, retries, maxRetries: MAX_RETRIES, reconnect };
}

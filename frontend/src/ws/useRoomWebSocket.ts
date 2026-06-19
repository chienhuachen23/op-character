import { useEffect, useRef, useCallback, useState } from 'react';
import { getStoredToken, WS_BASE } from '../api/client';

type WsHandler = (event: { type: string; payload: unknown }) => void;

export type WsConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export function useRoomWebSocket(
  roomCode: string | undefined,
  onMessage: WsHandler
): WsConnectionStatus {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const [status, setStatus] = useState<WsConnectionStatus>('disconnected');
  onMessageRef.current = onMessage;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!roomCode) {
      setStatus('disconnected');
      return undefined;
    }
    const token = getStoredToken();
    if (!token) {
      setStatus('disconnected');
      return undefined;
    }

    clearReconnectTimer();
    setStatus((s) => (s === 'connected' ? 'reconnecting' : s === 'disconnected' ? 'reconnecting' : s));

    const wsUrl = `${WS_BASE}/ws/rooms/${roomCode}/?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current(data);
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      setStatus('reconnecting');
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, 2000);
    };

    ws.onerror = () => {
      setStatus('reconnecting');
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(ping);
      clearReconnectTimer();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      ws.close();
      setStatus('disconnected');
    };
  }, [roomCode, clearReconnectTimer]);

  useEffect(() => {
    if (!roomCode) {
      setStatus('disconnected');
      return;
    }
    const cleanup = connect();
    return cleanup;
  }, [roomCode, connect]);

  return status;
}

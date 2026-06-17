import { useEffect, useRef, useCallback } from 'react';
import { getStoredToken, WS_BASE } from '../api/client';

type WsHandler = (event: { type: string; payload: unknown }) => void;

export function useRoomWebSocket(roomCode: string | undefined, onMessage: WsHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!roomCode) return undefined;
    const token = getStoredToken();
    if (!token) return undefined;

    clearReconnectTimer();

    const wsUrl = `${WS_BASE}/ws/rooms/${roomCode}/?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

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
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, 2000);
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
    };
  }, [roomCode, clearReconnectTimer]);

  useEffect(() => {
    if (!roomCode) return;
    const cleanup = connect();
    return cleanup;
  }, [roomCode, connect]);
}

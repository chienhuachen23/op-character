import { useEffect, useRef, useCallback } from 'react';
import { getStoredToken, WS_BASE } from '../api/client';

type WsHandler = (event: { type: string; payload: unknown }) => void;

export function useRoomWebSocket(roomCode: string | undefined, onMessage: WsHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!roomCode) return;
    const token = getStoredToken();
    if (!token) return;

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
      setTimeout(connect, 2000);
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [roomCode]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      wsRef.current?.close();
    };
  }, [connect]);
}

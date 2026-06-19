import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  api,
  clearSession,
  getStoredPlayer,
  getStoredToken,
  sessionMatchesRoom,
  storeSession,
  type Room,
  type RoomPreview,
} from '../../api/client';
import { useRoomWebSocket } from '../../ws/useRoomWebSocket';
import { Card, Button, Input, Select } from '../../components/ui';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { useToast } from '../../components/Toast';
import { setUILanguage } from '../../i18n';
import { useGameSfx } from '../../hooks/useGameSfx';
import { useHaptic } from '../../hooks/useHaptic';
import { LoadingScreen } from '../../components/Spinner';

function DepartureOverlay({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ocean/90 backdrop-blur-sm"
    >
      <motion.p
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-4xl font-extrabold text-straw drop-shadow-lg"
      >
        ⚓ {text}
      </motion.p>
    </motion.div>
  );
}

export function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { play } = useGameSfx();
  const { vibrate } = useHaptic();
  const mountedRef = useRef(true);
  const prevPlayerCountRef = useRef(0);
  const [room, setRoom] = useState<Room | null>(null);
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [needsJoin, setNeedsJoin] = useState(() => !sessionMatchesRoom(code));
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [departureText, setDepartureText] = useState<string | null>(null);
  const [pendingNavigate, setPendingNavigate] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPreview = useCallback(async () => {
    if (!code) return;
    try {
      const data = await api.getRoomPreview(code);
      setPreview(data);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [code]);

  const fetchRoom = useCallback(async () => {
    if (!code || !getStoredToken() || !sessionMatchesRoom(code)) {
      if (getStoredToken() && code && !sessionMatchesRoom(code)) {
        clearSession();
      }
      setNeedsJoin(true);
      await fetchPreview();
      return;
    }
    try {
      const data = await api.getRoom(code);
      if (!mountedRef.current) return;

      if (data.players.length > prevPlayerCountRef.current && prevPlayerCountRef.current > 0) {
        play('phase');
        if (data.players.length === 3) vibrate('success');
      }
      prevPlayerCountRef.current = data.players.length;

      setRoom(data);
      setNeedsJoin(false);
      setError('');
      const lobbyPath = `/room/${code}`;
      if (
        data.status === 'playing' &&
        (location.pathname === lobbyPath || location.pathname === `${lobbyPath}/`)
      ) {
        navigate(`/room/${code}/play`);
      } else if (data.status === 'replay_pending') {
        navigate(`/room/${code}/results`);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = (e as Error).message;
      if (msg.includes('token') || msg.includes('Token') || msg.toLowerCase().includes('mismatch')) {
        clearSession();
        setNeedsJoin(true);
        await fetchPreview();
      } else {
        setError(msg);
      }
    }
  }, [code, navigate, fetchPreview, location.pathname, play, vibrate]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  const wsStatus = useRoomWebSocket(needsJoin ? undefined : code, () => {
    if (needsJoin) fetchPreview();
    else fetchRoom();
  });

  const handleJoin = async () => {
    if (!code || !displayName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.joinRoom({
        room_code: code.toUpperCase(),
        display_name: displayName.trim(),
        language: i18n.language,
      });
      storeSession(res.player.token, { id: res.player.id, seat_index: res.player.seat_index }, code);
      setRoom(res.room);
      setNeedsJoin(false);
      play('submit');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!code) return;
    setLoading(true);
    try {
      await api.startRoom(code);
      play('phase');
      vibrate('phase');
      setDepartureText(t('departureOverlay'));
      setPendingNavigate(`/room/${code}/play`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyWithFeedback = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast(t('toast_copied'), 'success');
    vibrate('tap');
    play('tap');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCode = () => copyWithFeedback(code || '');
  const copyLink = () => copyWithFeedback(window.location.href);

  const seatCard = (player: Room['players'][0] | undefined, i: number, showOnline = false) => (
    <motion.div
      key={i}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: i * 0.1, type: 'spring', stiffness: 300 }}
      className={`rounded-xl border p-4 text-center transition-colors ${
        player
          ? 'border-straw/50 bg-ocean/50 shadow-md shadow-straw/10'
          : 'border-straw/20 bg-ocean/40'
      }`}
    >
      <p className="text-xs text-parchment/50">{t('seat')} {i + 1}</p>
      {player ? (
        <>
          <p className="font-bold mt-1">{player.display_name}</p>
          {showOnline && (
            <p className="text-xs mt-1 flex items-center justify-center gap-1">
              {player.is_host && <span className="text-straw">{t('host')} · </span>}
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  player.is_connected ? 'bg-green-400' : 'bg-parchment/30'
                }`}
              />
              <span className={player.is_connected ? 'text-green-400' : 'text-parchment/40'}>
                {player.is_connected ? t('online') : t('offline')}
              </span>
            </p>
          )}
        </>
      ) : (
        <p className="text-parchment/30 mt-2">—</p>
      )}
    </motion.div>
  );

  if (needsJoin) {
    const players = preview?.players ?? [];
    const seats = [0, 1, 2].map((i) => players.find((p) => p.seat_index === i));

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <ConnectionBanner status={wsStatus} />
        <motion.h1
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="text-3xl font-bold text-straw mb-6"
        >
          ⚓ {t('joinToEnter')}
        </motion.h1>

        <Card className="w-full max-w-md">
          <div className="text-center mb-6">
            <p className="text-parchment/60 text-sm">{t('roomCode')}</p>
            <p className="text-4xl font-mono font-bold text-straw tracking-widest">{code}</p>
            {preview && (
              <p className="text-sm text-parchment/60 mt-2">
                {t('playersInRoom', { count: preview.player_count, max: preview.max_players })}
              </p>
            )}
          </div>

          {preview && !preview.joinable && (
            <p className="text-red-400 text-center mb-4">
              {preview.player_count >= preview.max_players
                ? t('roomFull')
                : t('roomNotJoinable')}
            </p>
          )}

          {preview && (
            <div className="grid grid-cols-3 gap-2 mb-6">
              {seats.map((player, i) => seatCard(player, i))}
            </div>
          )}

          {preview?.joinable !== false && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-parchment/70 mb-1 block">{t('displayName')}</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={32}
                  placeholder={t('displayName')}
                />
              </div>
              <div>
                <label className="text-sm text-parchment/70 mb-1 block">{t('language')}</label>
                <Select
                  value={i18n.language}
                  onChange={(e) => setUILanguage(e.target.value as 'zh' | 'en')}
                >
                  <option value="zh">{t('chinese')}</option>
                  <option value="en">{t('english')}</option>
                </Select>
              </div>
              <Button
                className="w-full py-3"
                disabled={loading || !displayName.trim()}
                loading={loading}
                onClick={handleJoin}
              >
                {t('joinThisRoom')}
              </Button>
            </div>
          )}

          {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
        </Card>
      </div>
    );
  }

  if (!room) {
    return (
      <>
        <ConnectionBanner status={wsStatus} />
        <LoadingScreen message={error || t('loading')} />
      </>
    );
  }

  const canStart = room.players.length === 3;
  const storedPlayer = getStoredPlayer();
  const isHost = storedPlayer
    ? room.players.some((p) => p.id === storedPlayer.id && p.is_host)
    : false;
  const seats = [0, 1, 2].map((i) => room.players.find((p) => p.seat_index === i));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <ConnectionBanner status={wsStatus} />
      <AnimatePresence>
        {departureText && pendingNavigate && (
          <DepartureOverlay
            text={departureText}
            onDone={() => {
              if (pendingNavigate) navigate(pendingNavigate);
              setDepartureText(null);
              setPendingNavigate(null);
            }}
          />
        )}
      </AnimatePresence>

      <motion.h1
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="text-3xl font-bold text-straw mb-6"
      >
        {t('waiting')}
      </motion.h1>

      <Card className="w-full max-w-xl">
        <div className="text-center mb-6">
          <p className="text-parchment/60 text-sm">{t('roomCode')}</p>
          <p className="text-4xl font-mono font-bold text-straw tracking-widest">{room.code}</p>
          <div className="flex gap-2 justify-center mt-3">
            <Button variant="ghost" onClick={copyCode} className="text-sm">
              {copied ? t('copied') : t('copyCode')}
            </Button>
            <Button variant="ghost" onClick={copyLink} className="text-sm">
              {t('copyLink')}
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm text-parchment/70 mb-1 block">{t('language')}</label>
          <select
            className="w-full px-4 py-2 rounded-xl bg-ocean/80 border border-straw/30"
            value={i18n.language}
            onChange={async (e) => {
              const lang = e.target.value as 'zh' | 'en';
              setUILanguage(lang);
              await api.updatePlayer({ language: lang });
            }}
          >
            <option value="zh">{t('chinese')}</option>
            <option value="en">{t('english')}</option>
          </select>
        </div>

        <h2 className="text-lg font-semibold mb-4">{t('players')} (3)</h2>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {seats.map((player, i) => seatCard(player, i, true))}
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {isHost && (
          <Button
            className={`w-full py-3 ${canStart ? 'animate-pulse shadow-lg shadow-straw/40' : ''}`}
            disabled={!canStart || loading}
            loading={loading}
            onClick={handleStart}
          >
            {canStart ? t('startGame') : t('needThreePlayers')}
          </Button>
        )}
      </Card>
    </div>
  );
}

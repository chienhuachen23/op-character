import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
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
import { setUILanguage } from '../../i18n';

export function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [needsJoin, setNeedsJoin] = useState(() => !sessionMatchesRoom(code));
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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
      setRoom(data);
      setNeedsJoin(false);
      setError('');
      if (data.status === 'playing') {
        navigate(`/room/${code}/play`);
      } else if (data.status === 'replay_pending') {
        navigate(`/room/${code}/results`);
      }
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('token') || msg.includes('Token') || msg.toLowerCase().includes('mismatch')) {
        clearSession();
        setNeedsJoin(true);
        await fetchPreview();
      } else {
        setError(msg);
      }
    }
  }, [code, navigate, fetchPreview]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  useRoomWebSocket(needsJoin ? undefined : code, () => {
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
      navigate(`/room/${code}/play`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (needsJoin) {
    const players = preview?.players ?? [];
    const seats = [0, 1, 2].map((i) => players.find((p) => p.seat_index === i));

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
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
              {seats.map((player, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-straw/20 p-3 text-center bg-ocean/40 text-sm"
                >
                  <p className="text-xs text-parchment/50">{t('seat')} {i + 1}</p>
                  <p className="font-medium mt-1">{player?.display_name ?? '—'}</p>
                </div>
              ))}
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
                className="w-full"
                disabled={loading || !displayName.trim()}
                onClick={handleJoin}
              >
                {loading ? t('loading') : t('joinThisRoom')}
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
      <div className="min-h-screen flex items-center justify-center">
        <p>{error || t('loading')}</p>
      </div>
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
          {seats.map((player, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border border-straw/30 p-4 text-center bg-ocean/40"
            >
              <p className="text-xs text-parchment/50">{t('seat')} {i + 1}</p>
              {player ? (
                <>
                  <p className="font-bold mt-1">{player.display_name}</p>
                  <p className="text-xs mt-1">
                    {player.is_host && <span className="text-straw">{t('host')} · </span>}
                    <span className={player.is_connected ? 'text-green-400' : 'text-parchment/40'}>
                      {player.is_connected ? t('online') : t('offline')}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-parchment/30 mt-2">—</p>
              )}
            </motion.div>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {isHost && (
          <Button
            className="w-full"
            disabled={!canStart || loading}
            onClick={handleStart}
          >
            {canStart ? t('startGame') : t('needThreePlayers')}
          </Button>
        )}
      </Card>
    </div>
  );
}

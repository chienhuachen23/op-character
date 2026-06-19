import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { api, storeSession } from '../../api/client';
import { Card, Button, Input, Select, SfxToggle } from '../../components/ui';
import { setUILanguage } from '../../i18n';
import { useGameSfx } from '../../hooks/useGameSfx';

type Tab = 'create' | 'join';

export function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { play } = useGameSfx();
  const [tab, setTab] = useState<Tab>('create');
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameType, setGameType] = useState<'cooperative' | 'competitive'>('cooperative');
  const [totalRounds, setTotalRounds] = useState(5);
  const [targetRounds, setTargetRounds] = useState(3);
  const [earlyWin, setEarlyWin] = useState(true);
  const [endCondition, setEndCondition] = useState<'rounds' | 'score'>('rounds');
  const [maxRounds, setMaxRounds] = useState(5);
  const [targetScore, setTargetScore] = useState(20);
  const [correctPts, setCorrectPts] = useState(3);
  const [likePts, setLikePts] = useState(1);
  const [dislikePts, setDislikePts] = useState(-1);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lang = i18n.language as 'zh' | 'en';

  const handleCreate = async () => {
    if (!displayName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const settings =
        gameType === 'cooperative'
          ? { total_rounds: totalRounds, target_rounds: targetRounds, early_win_enabled: earlyWin }
          : {
              end_condition: endCondition,
              max_rounds: maxRounds,
              target_score: targetScore,
              scoring: {
                correct_guess: correctPts,
                hint_liked: likePts,
                hint_disliked: dislikePts,
              },
            };
      const res = await api.createRoom({
        game_mode: 'trait_guess',
        theme: 'one_piece',
        game_type: gameType,
        display_name: displayName.trim(),
        language: lang,
        settings,
      });
      storeSession(res.player.token, { id: res.player.id, seat_index: res.player.seat_index }, res.room.code);
      play('submit');
      navigate(`/room/${res.room.code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!displayName.trim() || !roomCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.joinRoom({
        room_code: roomCode.trim().toUpperCase(),
        display_name: displayName.trim(),
        language: lang,
      });
      storeSession(res.player.token, { id: res.player.id, seat_index: res.player.seat_index }, res.room.code);
      play('submit');
      navigate(`/room/${res.room.code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const competitiveRules = gameType === 'competitive' && tab === 'create' && (
    <>
      <div>
        <label className="text-sm text-parchment/70 mb-1 block">{t('selectMode')}</label>
        <Select value={endCondition} onChange={(e) => setEndCondition(e.target.value as 'rounds' | 'score')}>
          <option value="rounds">{t('endByRounds')}</option>
          <option value="score">{t('endByScore')}</option>
        </Select>
      </div>
      {endCondition === 'rounds' ? (
        <div>
          <label className="text-sm text-parchment/70 mb-1 block">{t('maxRounds')}</label>
          <Input type="number" min={1} max={20} value={maxRounds} onChange={(e) => setMaxRounds(+e.target.value)} />
        </div>
      ) : (
        <div>
          <label className="text-sm text-parchment/70 mb-1 block">{t('targetScore')}</label>
          <Input type="number" min={1} value={targetScore} onChange={(e) => setTargetScore(+e.target.value)} />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-parchment/70 mb-1 block">{t('correctGuessPts')}</label>
          <Input type="number" value={correctPts} onChange={(e) => setCorrectPts(+e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-parchment/70 mb-1 block">{t('hintLikedPts')}</label>
          <Input type="number" value={likePts} onChange={(e) => setLikePts(+e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-parchment/70 mb-1 block">{t('hintDislikedPts')}</label>
          <Input type="number" value={dislikePts} onChange={(e) => setDislikePts(+e.target.value)} />
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-extrabold text-straw drop-shadow-lg">
          ⚓ {t('appTitle')}
        </h1>
        <p className="text-parchment/70 mt-2">{t('appSubtitle')}</p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <SfxToggle />
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="text-xs text-parchment/40 hover:text-straw transition-colors underline-offset-2 hover:underline"
          >
            {t('adminEntry')}
          </button>
        </div>
      </motion.div>

      <Card className="w-full max-w-lg">
        <div className="relative flex gap-2 mb-6">
          <Button
            variant={tab === 'create' ? 'primary' : 'ghost'}
            className="flex-1"
            onClick={() => {
              play('tap');
              setTab('create');
            }}
          >
            {t('createRoom')}
          </Button>
          <Button
            variant={tab === 'join' ? 'primary' : 'ghost'}
            className="flex-1"
            onClick={() => {
              play('tap');
              setTab('join');
            }}
          >
            {t('joinRoom')}
          </Button>
          <motion.div
            layoutId="home-tab-indicator"
            className="absolute -bottom-1 h-0.5 bg-straw rounded-full"
            style={{
              width: 'calc(50% - 4px)',
              left: tab === 'create' ? '0' : 'calc(50% + 4px)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === 'create' ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === 'create' ? 16 : -16 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
          <div>
            <label className="text-sm text-parchment/70 mb-1 block">{t('displayName')}</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={32} />
          </div>

          <div>
            <label className="text-sm text-parchment/70 mb-1 block">{t('language')}</label>
            <Select
              value={lang}
              onChange={(e) => setUILanguage(e.target.value as 'zh' | 'en')}
            >
              <option value="zh">{t('chinese')}</option>
              <option value="en">{t('english')}</option>
            </Select>
          </div>

          {tab === 'join' ? (
            <div>
              <label className="text-sm text-parchment/70 mb-1 block">{t('roomCode')}</label>
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm text-parchment/70 mb-1 block">{t('theme')}</label>
                <Input value={t('onePiece')} disabled />
              </div>
              <div>
                <label className="text-sm text-parchment/70 mb-1 block">{t('selectMode')}</label>
                <Select
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value as 'cooperative' | 'competitive')}
                >
                  <option value="cooperative">{t('cooperative')}</option>
                  <option value="competitive">{t('competitive')}</option>
                </Select>
              </div>
              {gameType === 'cooperative' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-parchment/70 mb-1 block">{t('totalRounds')}</label>
                      <Input type="number" min={1} max={20} value={totalRounds} onChange={(e) => setTotalRounds(+e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-parchment/70 mb-1 block">{t('targetRounds')}</label>
                      <Input type="number" min={1} max={totalRounds} value={targetRounds} onChange={(e) => setTargetRounds(+e.target.value)} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={earlyWin} onChange={(e) => setEarlyWin(e.target.checked)} />
                    {earlyWin ? t('earlyWin') : t('mustCompleteAll')}
                  </label>
                </>
              ) : (
                <div>
                  <button
                    type="button"
                    className="text-sm text-straw hover:text-straw-dark flex items-center gap-1"
                    onClick={() => setRulesOpen((o) => !o)}
                  >
                    {rulesOpen ? '▼' : '▶'} {t('competitiveRules')}
                  </button>
                  <AnimatePresence>
                    {rulesOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-3 mt-3"
                      >
                        {competitiveRules}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button
            className="w-full py-3 text-lg"
            disabled={loading || !displayName.trim()}
            loading={loading}
            onClick={tab === 'create' ? handleCreate : handleJoin}
          >
            {tab === 'create' ? t('createRoom') : t('joinRoom')}
          </Button>
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { api, type MatchState, type MatchSummary } from '../../api/client';
import { useRoomWebSocket } from '../../ws/useRoomWebSocket';
import { Card, Button } from '../../components/ui';
import { CharacterCard } from '../../components/CharacterCard';
import { characterName } from '../../i18n';

type RoundSummary = MatchSummary['rounds'][number];

function normalizeRound(
  round: RoundSummary & { hints?: RoundSummary['hint_authors'] },
  playerFallback: RoundSummary['players']
): RoundSummary {
  let players = round.players ?? [];
  if (players.length === 0 && playerFallback.length > 0) {
    players = playerFallback;
  }
  const hint_authors = enrichHintAuthors(
    round.hint_authors ?? round.hints ?? [],
    players
  );
  return {
    ...round,
    players,
    hint_authors,
    scores: round.scores ?? {},
  };
}

function normalizeSummary(summary: MatchSummary): MatchSummary {
  const playerFallback: RoundSummary['players'] = summary.players.map((p, idx) => ({
    player_id: p.player_id,
    display_name: p.display_name,
    seat_index: idx,
    character: p.character,
  }));
  return {
    ...summary,
    rounds: (summary.rounds ?? []).map((round) => normalizeRound(round, playerFallback)),
  };
}

function enrichHintAuthors(
  hintAuthors: RoundSummary['hint_authors'],
  roundPlayers: RoundSummary['players']
): RoundSummary['hint_authors'] {
  return hintAuthors.map((author) => {
    if (author.other_characters && author.other_characters.length >= 2) {
      return author;
    }
    const others = roundPlayers
      .filter((p) => p.player_id !== author.author_id)
      .slice(0, 2);
    const other_characters = others.map((p) =>
      p.character
        ? { name_zh: p.character.name_zh, name_en: p.character.name_en }
        : { name_zh: '?', name_en: '?' }
    );
    while (other_characters.length < 2) {
      other_characters.push({ name_zh: '?', name_en: '?' });
    }
    return { ...author, other_characters };
  });
}

function formatRecapHintLink(
  author: RoundSummary['hint_authors'][number],
  lang: string,
  t: (key: string, opts?: Record<string, string>) => string
) {
  const chars = author.other_characters ?? [];
  if (chars.length < 2) return null;
  return t('recapHintLink', {
    character1: characterName(chars[0], lang),
    character2: characterName(chars[1], lang),
  });
}

function RoundRecapCard({
  round,
  gameType,
  lang,
  t,
}: {
  round: RoundSummary;
  gameType: string;
  lang: string;
  t: (key: string, opts?: Record<string, string | number>) => string;
}) {
  const topLikes = Math.max(0, ...(round.hint_authors ?? []).map((h) => h.likes));

  return (
    <div className="rounded-2xl border border-straw/20 bg-ocean/30 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-ocean/50 border-b border-straw/10">
        <h3 className="font-bold text-straw">{t('round', { n: round.round_number })}</h3>
        {gameType === 'cooperative' && round.is_coop_success !== null && (
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              round.is_coop_success
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}
          >
            {round.is_coop_success ? t('roundCoopSuccessShort') : t('roundCoopFailShort')}
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs text-parchment/50 mb-2">{t('roundCharacters')}</p>
        {(round.players ?? []).length === 0 ? (
          <p className="text-sm text-parchment/40 mb-4">{t('roundCharactersUnavailable')}</p>
        ) : (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(round.players ?? []).map((player) => (
            <CharacterCard
              key={player.player_id}
              character={player.character}
              displayName={player.display_name}
              language={lang}
              revealed
            />
          ))}
        </div>
        )}

        <p className="text-xs text-parchment/50 mb-2">{t('roundHintsAndRatings')}</p>
        <div className="space-y-3">
          {(round.hint_authors ?? []).map((author) => {
            const isTopHint = author.likes > 0 && author.likes === topLikes;
            const hintLink = formatRecapHintLink(author, lang, t);
            return (
              <div
                key={author.author_id}
                className={`rounded-xl p-3 ${
                  isTopHint
                    ? 'bg-straw/10 border border-straw/40'
                    : 'bg-ocean/40 border border-parchment/10'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{author.author_name}</span>
                    {isTopHint && (
                      <span className="text-xs text-straw font-medium">{t('bestHintRound')}</span>
                    )}
                  </div>
                  <div className="text-xs whitespace-nowrap">
                    <span className="text-green-400">👍 {author.likes}</span>
                    <span className="text-parchment/40 mx-1">·</span>
                    <span className="text-red-400">👎 {author.dislikes}</span>
                  </div>
                </div>
                {hintLink && (
                  <p className="text-sm text-parchment/70 mb-2">{hintLink}</p>
                )}
                {author.contents.length > 0 ? (
                  <ul className="space-y-1.5">
                    {author.contents.map((content, i) => (
                      <li
                        key={i}
                        className="text-sm text-parchment/90 pl-3 border-l-2 border-straw/30"
                      >
                        {content}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-parchment/40">{t('noHintsThisRound')}</p>
                )}
                {gameType === 'competitive' && round.scores[String(author.author_id)] !== undefined && (
                  <p className="text-xs text-straw/70 mt-2">
                    {t('roundPoints', { points: round.scores[String(author.author_id)] })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ResultsPoster() {
  const { code } = useParams<{ code: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState<MatchState | null>(null);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const lang = i18n.language;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const matchState = await api.getCurrentMatch();
      if (!mountedRef.current) return;
      if (matchState.room_status === 'playing') {
        navigate(`/room/${code}/play`);
        return;
      }
      setState(matchState);
      const sum = normalizeSummary(await api.getMatchSummary(matchState.match_id));
      setSummary(sum);
    } catch (e) {
      if (!mountedRef.current) return;
      setError((e as Error).message);
    }
  }, [code, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRoomWebSocket(code, (event) => {
    if (event.type === 'match.updated' || event.type === 'room.updated') {
      fetchData();
    }
    if (event.type === 'game.over') {
      fetchData();
    }
  });

  const handleReplay = async () => {
    if (!state) return;
    setLoading(true);
    try {
      const data = await api.requestReplay(state.match_id);
      if (data.room_status === 'playing') {
        navigate(`/room/${code}/play`);
      } else {
        setState(data);
        await fetchData();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineReplay = async () => {
    if (!state) return;
    setLoading(true);
    try {
      const data = await api.voteReplay(state.match_id, false);
      setState(data);
      await fetchData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!summary || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{error || t('loading')}</p>
      </div>
    );
  }

  const voteCount = Object.values(state.replay_votes).filter(Boolean).length;
  const hasVotedYes = state.replay_votes[String(state.self.player_id)] === true;
  const rankedPlayers = summary.competitive
    ? summary.competitive.ranking
        .map((id) => summary.players.find((p) => p.player_id === id))
        .filter((p): p is (typeof summary.players)[number] => !!p)
    : [];

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-extrabold text-straw mb-2">⚓ {t('gameOver')}</h1>
        {summary.coop && (
          <p className={`text-2xl font-bold ${summary.coop.won ? 'text-green-400' : 'text-red-400'}`}>
            {summary.coop.won ? t('victory') : t('defeat')}
            {' — '}
            {summary.coop.success_rounds}/{summary.coop.target_rounds} {t('successRounds')}
          </p>
        )}
        {summary.competitive && (
          <p className="text-lg text-parchment/70">{t('matchRecapSubtitle')}</p>
        )}
      </motion.div>

      {summary.competitive && rankedPlayers.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-straw mb-4 text-center">{t('finalRanking')}</h2>
          <div className="space-y-2">
            {rankedPlayers.map((player, index) => (
              <div
                key={player.player_id}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  index === 0
                    ? 'bg-straw/15 border border-straw/40'
                    : 'bg-ocean/40 border border-parchment/10'
                }`}
              >
                <span className="text-2xl w-8 text-center">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{player.display_name}</p>
                  {player.character && (
                    <p className="text-xs text-parchment/60 truncate">
                      {characterName(player.character, lang)}
                    </p>
                  )}
                </div>
                <p className="font-bold text-straw text-lg">{player.total_score}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {summary.rounds.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-straw mb-1 text-center">{t('matchRecap')}</h2>
          <p className="text-sm text-parchment/60 text-center mb-5">{t('matchRecapDesc')}</p>
          <div className="space-y-5">
            {summary.rounds.map((round, i) => (
              <motion.div
                key={round.round_number}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <RoundRecapCard
                  round={round}
                  gameType={summary.game_type}
                  lang={lang}
                  t={t}
                />
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="text-lg font-bold mb-4">{t('replayVotes')} ({voteCount}/3)</h2>
        <div className="flex gap-2 mb-4">
          {summary.players.map((p) => (
            <div
              key={p.player_id}
              className={`flex-1 text-center p-2 rounded-lg border ${
                state.replay_votes[String(p.player_id)]
                  ? 'border-green-400 bg-green-400/10'
                  : 'border-parchment/20'
              }`}
            >
              {p.display_name}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleReplay} disabled={loading || hasVotedYes}>
            {hasVotedYes ? t('replayVoted') : t('replay')}
          </Button>
          <Button variant="ghost" onClick={handleDeclineReplay} disabled={loading}>
            {t('declineReplay')}
          </Button>
        </div>
      </Card>

      {error && <p className="text-red-400 text-center mb-4">{error}</p>}

      <Button variant="ghost" className="w-full" onClick={() => navigate('/', { replace: true })}>
        {t('backHome')}
      </Button>
    </div>
  );
}

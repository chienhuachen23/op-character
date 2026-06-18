import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { api, type MatchState } from '../../api/client';
import { useRoomWebSocket } from '../../ws/useRoomWebSocket';
import { Card, Button, Input, Modal } from '../../components/ui';
import { CharacterCard } from '../../components/CharacterCard';
import { characterName } from '../../i18n';

function isOwnHint(hint: MatchState['hints'][0], selfPlayerId: number): boolean {
  if (hint.is_own === true) return true;
  if (hint.is_own === false) return false;
  return hint.author_id === selfPlayerId;
}

function formatHintText(
  hint: MatchState['hints'][0],
  state: MatchState,
  lang: string,
  t: (key: string, opts?: Record<string, string>) => string
) {
  if (isOwnHint(hint, state.self.player_id)) {
    return t('hintOwn', { content: hint.content });
  }

  const other = state.others.find((o) => o.player_id !== hint.author_id);
  const name = hint.other_player_name ?? other?.display_name ?? '?';
  const charName = hint.other_character
    ? lang === 'zh'
      ? hint.other_character.name_zh
      : hint.other_character.name_en
    : other?.character
      ? characterName(other.character, lang)
      : '?';

  return t('hintForYou', { name, character: charName, content: hint.content });
}

function HintText({
  hint,
  state,
  lang,
  t,
  className = '',
}: {
  hint: MatchState['hints'][0];
  state: MatchState;
  lang: string;
  t: (key: string, opts?: Record<string, string>) => string;
  className?: string;
}) {
  const withdrawn = hint.is_withdrawn === true;
  return (
    <p
      className={`${className} ${withdrawn ? 'line-through text-parchment/40 decoration-parchment/50' : ''}`.trim()}
    >
      {formatHintText(hint, state, lang, t)}
    </p>
  );
}

function formatGuessIncorrectMessage(
  guess: MatchState['guesses'][0],
  state: MatchState,
  t: (key: string, opts?: Record<string, string>) => string
) {
  const nameById = new Map<number, string>();
  for (const other of state.others) {
    nameById.set(other.player_id, other.display_name);
  }

  const wrongVoters = guess.votes
    .filter((v) => !v.is_correct)
    .map((v) => nameById.get(v.voter_id) ?? '?');

  if (wrongVoters.length >= 2) {
    return t('guessIncorrectTwo', { name1: wrongVoters[0], name2: wrongVoters[1] });
  }
  if (wrongVoters.length === 1) {
    return t('guessIncorrectOne', { name: wrongVoters[0] });
  }
  return t('guessIncorrect');
}

function GuessHistoryList({
  history,
  t,
}: {
  history: Array<{ text: string; verdict: string }>;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  if (!history.length) return null;
  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-parchment/50">{t('guessHistory')}</p>
      {history.map((entry, i) => (
        <p
          key={`${entry.text}-${i}`}
          className={`text-xs ${
            entry.verdict === 'correct'
              ? 'text-green-400'
              : entry.verdict === 'incorrect'
                ? 'text-red-300'
                : 'text-parchment/60'
          }`}
        >
          {entry.verdict === 'correct'
            ? t('guessHistoryCorrect', { text: entry.text })
            : entry.verdict === 'incorrect'
              ? t('guessHistoryWrong', { text: entry.text })
              : `「${entry.text}」`}
        </p>
      ))}
    </div>
  );
}

function WrongGuessesList({
  history,
  t,
}: {
  history: Array<{ text: string; verdict: string }>;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const wrong = history.filter((entry) => entry.verdict === 'incorrect');
  if (!wrong.length) return null;
  return (
    <div className="mb-3">
      <p className="text-xs text-parchment/60 mb-1">{t('excludedWrongGuesses')}</p>
      <ul className="space-y-1">
        {wrong.map((entry, i) => (
          <li key={`${entry.text}-${i}`} className="text-sm text-red-300">
            {t('guessHistoryWrong', { text: entry.text })}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CharacterRerollPanel({
  state,
  targetPlayerId,
  isPlayPhase,
  loading,
  t,
  onRequest,
  onConfirm,
}: {
  state: MatchState;
  targetPlayerId: number;
  isPlayPhase: boolean;
  loading: boolean;
  t: (key: string, opts?: Record<string, string>) => string;
  onRequest: (targetPlayerId: number) => void;
  onConfirm: (targetPlayerId: number, approved: boolean) => void;
}) {
  if (!isPlayPhase) return null;

  const selfId = state.self.player_id;
  const reroll = state.character_reroll;
  const pendingForTarget =
    reroll?.status === 'pending' && reroll.target_player_id === targetPlayerId;

  if (pendingForTarget && reroll) {
    if (selfId === reroll.confirmer_player_id) {
      return (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-parchment/70 text-center">
            {t('rerollConfirmPrompt', {
              requester: reroll.requester_player_name,
              target: reroll.target_player_name,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1 text-sm py-2"
              disabled={loading}
              onClick={() => onConfirm(targetPlayerId, true)}
            >
              {t('rerollApprove')}
            </Button>
            <Button
              className="flex-1 text-sm py-2"
              variant="ghost"
              disabled={loading}
              onClick={() => onConfirm(targetPlayerId, false)}
            >
              {t('rerollReject')}
            </Button>
          </div>
        </div>
      );
    }
    if (selfId === reroll.requester_player_id) {
      return (
        <p className="text-xs text-parchment/60 mt-2 text-center">{t('rerollWaitingConfirm')}</p>
      );
    }
    if (selfId === targetPlayerId) {
      return (
        <p className="text-xs text-amber-200/90 mt-2 text-center">{t('rerollPendingForYou')}</p>
      );
    }
    return null;
  }

  if (!reroll && selfId !== targetPlayerId) {
    return (
      <Button
        variant="ghost"
        className="mt-2 w-full text-sm"
        disabled={loading}
        onClick={() => onRequest(targetPlayerId)}
      >
        {t('rerollRequest')}
      </Button>
    );
  }

  return null;
}

export function GameBoard() {
  const { code } = useParams<{ code: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState<MatchState | null>(null);
  const [hintText, setHintText] = useState('');
  const [guessText, setGuessText] = useState('');
  const [guessModalOpen, setGuessModalOpen] = useState(false);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
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

  const fetchState = useCallback(async () => {
    try {
      const data = await api.getCurrentMatch();
      if (!mountedRef.current) return;
      setState(data);
      if (data.room_status === 'replay_pending' || data.match_status === 'finished') {
        navigate(`/room/${code}/results`);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError((e as Error).message);
    }
  }, [code, navigate]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useRoomWebSocket(code, () => {
    fetchState();
  });

  const myGuess = state?.guesses.find((g) => g.player_id === state.self.player_id);
  const phase = state?.round.phase;
  const isPlayPhase =
    phase !== 'rating' && phase !== 'settlement' && phase !== 'complete';

  const canGuess =
    !myGuess ||
    myGuess.verdict === 'incorrect';
  const canHint = isPlayPhase;
  const hasGuessedCorrectly = myGuess?.verdict === 'correct';
  const hasSkippedGuess = myGuess?.verdict === 'skipped';
  const hasRevealedCharacter = hasGuessedCorrectly || hasSkippedGuess;
  const canSubmitGuess = canGuess && myGuess?.verdict !== 'pending';
  const isGuessPending = myGuess?.verdict === 'pending';
  const showGuessSection =
    isPlayPhase && (canSubmitGuess || isGuessPending || hasRevealedCharacter);

  const handleHint = async () => {
    if (!hintText.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.submitHint(hintText.trim());
      setState(data);
      setHintText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHint = async (hintId: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.deleteHint(hintId);
      setState(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuess = async (skip = false) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.submitGuess(
        skip ? { skip: true } : { text: guessText.trim() }
      );
      setState(data);
      if (skip) {
        setSkipConfirmOpen(false);
      } else {
        setGuessText('');
        setGuessModalOpen(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (guessId: number, isCorrect: boolean) => {
    setLoading(true);
    try {
      const data = await api.submitGuessVote(guessId, isCorrect);
      setState(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRating = async (authorId: number, rating: 'like' | 'dislike') => {
    setLoading(true);
    try {
      const data = await api.submitAuthorHintRating(authorId, rating);
      setState(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRerollRequest = async (targetPlayerId: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.requestCharacterReroll(targetPlayerId);
      setState(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRerollConfirm = async (targetPlayerId: number, approved: boolean) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.confirmCharacterReroll(targetPlayerId, approved);
      setState(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{error || t('loading')}</p>
      </div>
    );
  }

  const myHints = state.hints.filter((h) => isOwnHint(h, state.self.player_id));
  const othersHints = state.hints.filter((h) => !isOwnHint(h, state.self.player_id));

  const pendingOthersGuesses = state.guesses.filter(
    (g) =>
      g.player_id !== state.self.player_id &&
      !g.is_skipped &&
      g.verdict === 'pending'
  );

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto">
      <motion.div
        key={phase}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-6 flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-straw">
            {t('round', { n: state.round.number })}
          </h1>
          <p className="text-parchment/70">
            {isPlayPhase ? t('phase_hints') : t(`phase_${phase}`)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.game_type === 'cooperative' && state.coop && (
            <div className="text-sm bg-ocean/60 px-4 py-2 rounded-xl border border-straw/30">
              {t('successRounds')}: {state.coop.success_rounds} / {state.coop.target_rounds}
            </div>
          )}
          <Button variant="ghost" onClick={() => navigate('/', { replace: true })}>
            {t('exitGame')}
          </Button>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="min-w-0">
          <CharacterCard
            isSelf
            character={state.self.character}
            displayName={state.self.display_name}
            language={lang}
            revealed={!!state.self.character}
          />
          <CharacterRerollPanel
            state={state}
            targetPlayerId={state.self.player_id}
            isPlayPhase={isPlayPhase}
            loading={loading}
            t={t}
            onRequest={handleRerollRequest}
            onConfirm={handleRerollConfirm}
          />
        </div>
        {state.others.map((o) => (
          <div key={o.player_id} className="min-w-0">
            <CharacterCard
              character={o.character}
              displayName={o.display_name}
              language={lang}
            />
            <CharacterRerollPanel
              state={state}
              targetPlayerId={o.player_id}
              isPlayPhase={isPlayPhase}
              loading={loading}
              t={t}
              onRequest={handleRerollRequest}
              onConfirm={handleRerollConfirm}
            />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
        >
          {isPlayPhase && (
            <>
              {myHints.length > 0 && (
                <Card className="mb-4">
                  <h2 className="text-lg font-bold mb-3">{t('hintsSent')}</h2>
                  <div className="space-y-3">
                    {myHints.map((h) => (
                      <div
                        key={h.id}
                        className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm bg-straw/10 border border-straw/30"
                      >
                        <HintText hint={h} state={state} lang={lang} t={t} className="flex-1" />
                        {canHint && !h.is_withdrawn && (
                          <Button
                            variant="ghost"
                            className="shrink-0 text-xs py-1 px-2"
                            disabled={loading}
                            onClick={() => handleDeleteHint(h.id)}
                          >
                            {t('withdrawHint')}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {othersHints.length > 0 && (
                <Card className="mb-4">
                  <h2 className="text-lg font-bold mb-3">{t('hintsFromOthers')}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {state.others.map((other) => {
                      const hints = othersHints.filter((h) => h.author_id === other.player_id);
                      return (
                        <div
                          key={other.player_id}
                          className="rounded-xl border border-parchment/10 bg-ocean/50 p-4 min-h-[5rem]"
                        >
                          <p className="text-sm font-semibold text-straw mb-3">
                            {other.display_name}
                          </p>
                          {hints.length === 0 ? (
                            <p className="text-sm text-parchment/40">—</p>
                          ) : (
                            <div className="space-y-2">
                              {hints.map((h) => (
                                <div
                                  key={h.id}
                                  className="px-3 py-2 rounded-lg text-sm bg-ocean/60 border border-parchment/10"
                                >
                                  <HintText hint={h} state={state} lang={lang} t={t} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {pendingOthersGuesses.length > 0 && (
                <Card className="mb-4">
                  <h2 className="text-lg font-bold mb-3">{t('phase_judging')}</h2>
                  {pendingOthersGuesses.map((g) => {
                    const alreadyVoted = g.votes.some(
                      (v) => v.voter_id === state.self.player_id
                    );
                    return (
                      <div key={g.id} className="mb-4 p-4 bg-ocean/40 rounded-xl">
                        <p className="mb-2">
                          {t('judgeGuess', {
                            name: g.player_name,
                            text: g.guess_text,
                          })}
                        </p>
                        {!alreadyVoted ? (
                          <div className="flex gap-2">
                            <Button onClick={() => handleVote(g.id, true)} disabled={loading}>
                              {t('voteCorrect')}
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => handleVote(g.id, false)}
                              disabled={loading}
                            >
                              {t('voteIncorrect')}
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-green-400">{t('waitingForOthers')}</p>
                        )}
                      </div>
                    );
                  })}
                </Card>
              )}

              {canHint && (
                <Card className="mb-4">
                  <h2 className="text-lg font-bold mb-4">{t('sendHint')}</h2>
                  <div className="flex gap-2">
                    <Input
                      value={hintText}
                      onChange={(e) => setHintText(e.target.value)}
                      placeholder={t('hintPlaceholder')}
                      onKeyDown={(e) => e.key === 'Enter' && handleHint()}
                    />
                    <Button onClick={handleHint} disabled={loading || !hintText.trim()}>
                      {t('sendHint')}
                    </Button>
                  </div>
                </Card>
              )}

              {showGuessSection && (
                <Card className="mb-4">
                  <h2 className="text-lg font-bold mb-4">{t('guessAnytime')}</h2>
                  {hasGuessedCorrectly ? (
                    <>
                      <p className="text-green-400 text-center py-2">{t('guessCorrect')}</p>
                      {myGuess && (myGuess.guess_history?.length ?? 0) > 0 && (
                        <GuessHistoryList history={myGuess.guess_history} t={t} />
                      )}
                    </>
                  ) : hasSkippedGuess ? (
                    <>
                      <p className="text-parchment/70 text-center py-2">{t('guessSkippedReveal')}</p>
                      {myGuess && (myGuess.guess_history?.length ?? 0) > 0 && (
                        <GuessHistoryList history={myGuess.guess_history} t={t} />
                      )}
                    </>
                  ) : isGuessPending && myGuess ? (
                    <p className="text-parchment/70 text-center py-2">
                      {t('guessPending')}「{myGuess.guess_text}」
                    </p>
                  ) : canSubmitGuess ? (
                    <>
                      {myGuess?.verdict === 'incorrect' && (
                        <p className="text-red-400 text-sm mb-3">
                          {formatGuessIncorrectMessage(myGuess, state, t)}
                        </p>
                      )}
                      {myGuess && (
                        <WrongGuessesList history={myGuess.guess_history ?? []} t={t} />
                      )}
                    </>
                  ) : null}
                </Card>
              )}

              {showGuessSection && (
                <div className="flex justify-between gap-4 mb-4">
                  {!hasSkippedGuess && (
                    <Button
                      className={`flex-1 ${
                        hasGuessedCorrectly
                          ? 'bg-green-600 text-white hover:bg-green-600 disabled:opacity-100 cursor-default shadow-none hover:scale-100 active:scale-100'
                          : isGuessPending
                            ? 'disabled:opacity-70 cursor-default hover:scale-100 active:scale-100'
                            : ''
                      }`}
                      disabled={loading || !canSubmitGuess}
                      onClick={() => setGuessModalOpen(true)}
                    >
                      {hasGuessedCorrectly
                        ? t('guessButtonCorrect')
                        : isGuessPending
                          ? t('guessButtonReviewing')
                          : t('guessButton')}
                    </Button>
                  )}
                  {!hasGuessedCorrectly && (
                    <Button
                      variant="ghost"
                      className={`flex-1 font-bold ${
                        hasSkippedGuess
                          ? 'bg-red-600 text-white border-red-600 hover:bg-red-600 disabled:opacity-100 cursor-default shadow-none hover:scale-100 active:scale-100'
                          : 'bg-parchment text-ocean border-parchment/80 hover:bg-parchment/90 disabled:opacity-70 cursor-default hover:scale-100 active:scale-100'
                      }`}
                      disabled={loading || !canSubmitGuess}
                      onClick={() => setSkipConfirmOpen(true)}
                    >
                      {hasSkippedGuess ? t('skipButtonSurrender') : t('skipButtonShort')}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {phase === 'rating' && (
            <>
              {state.round_result && (
                <Card className="mb-4">
                  <h2 className="text-lg font-bold mb-4">{t('roundResult')}</h2>
                  <div className="space-y-2 mb-4">
                    {state.round_result.guesses.map((g) => (
                      <div
                        key={g.player_id}
                        className={`px-4 py-3 rounded-xl text-sm ${
                          g.verdict === 'correct'
                            ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                            : g.is_skipped
                              ? 'bg-parchment/5 border border-parchment/20 text-parchment/60'
                              : 'bg-red-500/10 border border-red-500/30 text-red-300'
                        }`}
                      >
                        <p>
                          {g.is_skipped
                            ? t('roundGuessSkipped', { name: g.player_name })
                            : g.verdict === 'correct'
                              ? t('roundGuessCorrect', {
                                  name: g.player_name,
                                })
                              : t('roundGuessIncorrect', {
                                  name: g.player_name,
                                })}
                        </p>
                        {!g.is_skipped && g.guess_text && g.verdict !== 'skipped' && (
                          <p className="text-xs mt-1 opacity-80">「{g.guess_text}」</p>
                        )}
                        <GuessHistoryList history={g.guess_history ?? []} t={t} />
                      </div>
                    ))}
                  </div>

                  {state.game_type === 'cooperative' && (
                    <p
                      className={`text-center font-semibold ${
                        state.round_result.is_coop_success ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {state.round_result.is_coop_success
                        ? t('roundCoopSuccess')
                        : t('roundCoopFail')}
                    </p>
                  )}

                  {state.game_type === 'competitive' && state.round_result.scores && (
                    <div>
                      <h3 className="text-sm font-semibold text-straw mb-1">{t('currentScores')}</h3>
                      <p className="text-xs text-parchment/50 mb-2">{t('pendingGuessPoints')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[state.self, ...state.others]
                          .sort((a, b) => {
                            const aScore = state.round_result!.scores![String(a.player_id)] ?? 0;
                            const bScore = state.round_result!.scores![String(b.player_id)] ?? 0;
                            return bScore - aScore;
                          })
                          .map((p) => {
                            const current =
                              state.round_result!.scores![String(p.player_id)] ?? 0;
                            const pending =
                              state.round_result!.pending_scores?.[String(p.player_id)] ?? 0;
                            return (
                            <div
                              key={p.player_id}
                              className="text-center p-2 rounded-lg bg-ocean/50 border border-straw/20"
                            >
                              <p className="text-xs text-parchment/60">{p.display_name}</p>
                              <p className="font-bold text-straw">
                                {t('points', { score: current })}
                                {pending > 0 && (
                                  <span className="text-green-400 text-sm ml-1">
                                    +{pending}
                                  </span>
                                )}
                              </p>
                            </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {myHints.length > 0 && (
                <Card className="mb-4">
                  <h2 className="text-lg font-bold mb-3">{t('yourHints')}</h2>
                  <div className="space-y-2">
                    {myHints.map((h) => (
                      <div
                        key={h.id}
                        className="px-3 py-2 rounded-lg text-sm bg-straw/10 border border-straw/30"
                      >
                        <HintText hint={h} state={state} lang={lang} t={t} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card>
              <h2 className="text-lg font-bold mb-4">{t('rateHints')}</h2>
              {(state.hint_rating_groups?.length ?? 0) === 0 ? (
                <p className="text-parchment/60">{t('waitingForOthers')}</p>
              ) : (
                state.hint_rating_groups.map((group) => (
                  <div
                    key={group.author_id}
                    className="mb-4 p-4 bg-ocean/40 rounded-xl"
                  >
                    <p className="text-sm font-semibold text-straw mb-3">{group.author_name}</p>
                    <div className="space-y-2 mb-4">
                      {group.hints.map((h) => (
                        <div
                          key={h.id}
                          className="px-3 py-2 rounded-lg text-sm bg-ocean/50 border border-parchment/10"
                        >
                          <HintText hint={h} state={state} lang={lang} t={t} />
                        </div>
                      ))}
                    </div>
                    {group.my_rating ? (
                      <p className="text-sm text-parchment/70">
                        {group.my_rating === 'like' ? `👍 ${t('like')}` : `👎 ${t('dislike')}`}
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => handleRating(group.author_id, 'like')}
                          disabled={loading}
                        >
                          👍 {t('like')}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleRating(group.author_id, 'dislike')}
                          disabled={loading}
                        >
                          👎 {t('dislike')}
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </Card>
            </>
          )}

          {(phase === 'settlement' || phase === 'complete') && (
            <Card>
              <p className="text-center text-lg animate-pulse">{t('loading')}</p>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="text-red-400 text-center mt-4">{error}</p>}

      <Modal
        open={guessModalOpen}
        onClose={() => setGuessModalOpen(false)}
        title={t('actionModeGuess')}
      >
        <Input
          value={guessText}
          onChange={(e) => setGuessText(e.target.value)}
          placeholder={t('guessPlaceholder')}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && guessText.trim() && handleGuess(false)}
        />
        <div className="flex gap-2 mt-4">
          <Button
            className="flex-1"
            onClick={() => handleGuess(false)}
            disabled={loading || !guessText.trim()}
          >
            {t('submitGuess')}
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => setGuessModalOpen(false)}>
            {t('cancel')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={skipConfirmOpen}
        onClose={() => setSkipConfirmOpen(false)}
        title={t('skipGuess')}
      >
        <p className="text-parchment/80 mb-6">{t('confirmSkipGuess')}</p>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => handleGuess(true)}
            disabled={loading}
          >
            {t('confirmSkipYes')}
          </Button>
          <Button
            variant="ghost"
            className="flex-1 bg-parchment text-ocean border-parchment/80 hover:bg-parchment/90 font-bold"
            onClick={() => setSkipConfirmOpen(false)}
          >
            {t('cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

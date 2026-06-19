import { useEffect, useRef } from 'react';
import type { MatchState } from '../api/client';
import type { SfxName } from './useGameSfx';

export type MatchStateDiffEvent =
  | { type: 'phase_change'; phase: string }
  | { type: 'new_hint'; authorName: string; isOwn: boolean; hintId: number }
  | { type: 'new_pending_guess'; playerName: string }
  | { type: 'self_revealed'; skipped: boolean }
  | { type: 'guess_incorrect' }
  | { type: 'guess_correct' }
  | { type: 'coop_round_result'; success: boolean };

type DiffHandlers = {
  onEvent?: (event: MatchStateDiffEvent) => void;
  playSfx?: (name: SfxName) => void;
  vibrate?: (pattern: 'tap' | 'success' | 'error' | 'phase') => void;
};

function isOwnHint(hint: MatchState['hints'][0], selfPlayerId: number): boolean {
  if (hint.is_own === true) return true;
  if (hint.is_own === false) return false;
  return hint.author_id === selfPlayerId;
}

export function useMatchStateDiff(
  state: MatchState | null,
  handlers: DiffHandlers
) {
  const prevRef = useRef<MatchState | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!state) return;
    const prev = prevRef.current;
    if (!prev) {
      prevRef.current = state;
      return;
    }

    const { onEvent, playSfx, vibrate } = handlersRef.current;
    const selfId = state.self.player_id;

    if (prev.round.phase !== state.round.phase && state.round.phase) {
      onEvent?.({ type: 'phase_change', phase: state.round.phase });
      playSfx?.('phase');
      vibrate?.('phase');
    }

    const prevHintIds = new Set(prev.hints.map((h) => h.id));
    for (const hint of state.hints) {
      if (!prevHintIds.has(hint.id) && !hint.is_withdrawn) {
        const isOwn = isOwnHint(hint, selfId);
        const author =
          state.others.find((o) => o.player_id === hint.author_id)?.display_name ??
          state.self.display_name ??
          '?';
        onEvent?.({ type: 'new_hint', authorName: author, isOwn, hintId: hint.id });
        if (!isOwn) playSfx?.('tap');
      }
    }

    const prevPending = prev.guesses.filter(
      (g) => g.player_id !== selfId && !g.is_skipped && g.verdict === 'pending'
    );
    const currPending = state.guesses.filter(
      (g) => g.player_id !== selfId && !g.is_skipped && g.verdict === 'pending'
    );
    for (const g of currPending) {
      if (!prevPending.some((p) => p.id === g.id)) {
        onEvent?.({ type: 'new_pending_guess', playerName: g.player_name });
        playSfx?.('submit');
      }
    }

    const prevMyGuess = prev.guesses.find((g) => g.player_id === selfId);
    const currMyGuess = state.guesses.find((g) => g.player_id === selfId);

    if (!prev.self.character && state.self.character) {
      const skipped = currMyGuess?.verdict === 'skipped';
      onEvent?.({ type: 'self_revealed', skipped });
      if (!skipped) {
        playSfx?.('correct');
        vibrate?.('success');
      } else {
        playSfx?.('phase');
      }
    } else if (
      prevMyGuess?.verdict !== 'incorrect' &&
      currMyGuess?.verdict === 'incorrect'
    ) {
      onEvent?.({ type: 'guess_incorrect' });
      playSfx?.('wrong');
      vibrate?.('error');
    } else if (
      prevMyGuess?.verdict !== 'correct' &&
      currMyGuess?.verdict === 'correct'
    ) {
      onEvent?.({ type: 'guess_correct' });
    }

    if (
      state.round.phase === 'rating' &&
      prev.round.phase !== 'rating' &&
      state.round_result &&
      state.game_type === 'cooperative'
    ) {
      onEvent?.({
        type: 'coop_round_result',
        success: !!state.round_result.is_coop_success,
      });
      if (state.round_result.is_coop_success) {
        playSfx?.('correct');
        vibrate?.('success');
      } else {
        playSfx?.('wrong');
      }
    }

    prevRef.current = state;
  }, [state]);
}

export function useHighlightedIds() {
  const hintIdsRef = useRef<Set<number>>(new Set());
  const guessIdsRef = useRef<Set<number>>(new Set());

  const markHint = (id: number) => {
    hintIdsRef.current.add(id);
    setTimeout(() => hintIdsRef.current.delete(id), 2000);
  };

  const markGuess = (id: number) => {
    guessIdsRef.current.add(id);
    setTimeout(() => guessIdsRef.current.delete(id), 2000);
  };

  const isHintHighlighted = (id: number) => hintIdsRef.current.has(id);
  const isGuessHighlighted = (id: number) => guessIdsRef.current.has(id);

  return { markHint, markGuess, isHintHighlighted, isGuessHighlighted };
}

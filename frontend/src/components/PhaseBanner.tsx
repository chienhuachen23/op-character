import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { MatchState } from '../api/client';

export type PlaySubPhase = 'judging' | 'guessing' | 'reviewing' | 'hints';

function resolvePlaySubPhase(
  pendingOthersCount: number,
  isGuessPending: boolean,
  hasRevealedCharacter: boolean
): PlaySubPhase {
  if (pendingOthersCount > 0) return 'judging';
  if (isGuessPending) return 'reviewing';
  if (!hasRevealedCharacter) return 'guessing';
  return 'hints';
}

const phaseAccent: Record<string, string> = {
  judging: 'border-amber-400/60 bg-amber-500/10',
  guessing: 'border-straw/50 bg-straw/10',
  reviewing: 'border-sky-400/50 bg-sky-500/10',
  hints: 'border-straw/30 bg-ocean/60',
  rating: 'border-purple-400/50 bg-purple-500/10',
  settlement: 'border-parchment/30 bg-ocean/70',
};

export function PhaseBanner({
  state,
  pendingOthersCount,
  isGuessPending,
  hasRevealedCharacter,
  isPlayPhase,
}: {
  state: MatchState;
  pendingOthersCount: number;
  isGuessPending: boolean;
  hasRevealedCharacter: boolean;
  isPlayPhase: boolean;
}) {
  const { t } = useTranslation();
  const phase = state.round.phase;

  let label: string;
  let accentKey: string;

  if (isPlayPhase) {
    const sub = resolvePlaySubPhase(
      pendingOthersCount,
      isGuessPending,
      hasRevealedCharacter
    );
    accentKey = sub;
    label =
      sub === 'judging'
        ? t('phase_judging')
        : sub === 'guessing'
          ? t('phase_guessing')
          : sub === 'reviewing'
            ? t('guessButtonReviewing')
            : t('phase_hints');
  } else if (phase === 'rating') {
    accentKey = 'rating';
    label = t('phase_rating');
  } else if (phase === 'settlement' || phase === 'complete') {
    accentKey = 'settlement';
    label = t('phase_settlement_desc');
  } else {
    accentKey = 'hints';
    label = t(`phase_${phase}`);
  }

  const coopProgress =
    state.game_type === 'cooperative' && state.coop
      ? state.coop.success_rounds / state.coop.target_rounds
      : null;

  return (
    <motion.div
      key={`${phase}-${label}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'sticky top-0 z-30 -mx-4 px-4 py-3 mb-4 border-b backdrop-blur-md',
        phaseAccent[accentKey] ?? phaseAccent.hints
      )}
    >
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-straw">
            {t('round', { n: state.round.number })}
          </h1>
          <p className="text-sm text-parchment/80 font-medium">{label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {coopProgress !== null && state.coop && (
            <div className="min-w-[140px]">
              <p className="text-xs text-parchment/60 mb-1">
                {t('successRounds')}: {state.coop.success_rounds} / {state.coop.target_rounds}
              </p>
              <div className="h-2 rounded-full bg-ocean/80 overflow-hidden border border-straw/20">
                <motion.div
                  className={clsx(
                    'h-full rounded-full',
                    coopProgress >= 1 ? 'bg-green-400' : 'bg-straw'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, coopProgress * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function SettlementWaiting() {
  const { t } = useTranslation();

  return (
    <div className="text-center py-8 space-y-6">
      <p className="text-lg text-parchment/90">{t('phase_settlement_desc')}</p>
      <div className="flex justify-center gap-3 text-3xl">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ y: [0, -12, 0] }}
            transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 }}
          >
            🏴‍☠️
          </motion.span>
        ))}
      </div>
      <div className="flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-straw"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}

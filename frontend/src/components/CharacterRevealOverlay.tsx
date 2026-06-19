import { useEffect } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Character } from '../api/client';
import { characterName } from '../i18n';
import {
  CharacterPortrait,
  CharacterPortraitSlot,
  CHARACTER_CARD_PORTRAIT_SHELL,
} from './CharacterPortrait';
import { useReducedMotion } from '../hooks/useReducedMotion';

const SPIN_DEG = 900; // 2.5 turns, ends on front face (900 ≡ 180 mod 360)
const SPIN_DURATION = 1.8;

interface CharacterRevealOverlayProps {
  character: Character;
  displayName?: string;
  language: string;
  skipped?: boolean;
  onComplete: () => void;
}

export function CharacterRevealOverlay({
  character,
  displayName,
  language,
  skipped = false,
  onComplete,
}: CharacterRevealOverlayProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      onComplete();
    }
  }, [reducedMotion, onComplete]);

  if (reducedMotion) return null;

  const cardClass = clsx(
    'w-full max-w-xs rounded-2xl border-2 p-6 text-center shadow-2xl',
    skipped
      ? 'border-red-400/50 bg-gradient-to-b from-red-900/30 to-ocean/90'
      : 'border-straw bg-gradient-to-b from-parchment/20 to-ocean/90'
  );

  const name = characterName(character, language);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
    >
      <div className={cardClass}>
        {displayName && (
          <p className="text-sm text-straw/80 mb-3 font-medium">{displayName}</p>
        )}
        <div className="mx-auto w-4/5" style={{ perspective: 1200 }}>
          <motion.div
            className="relative w-full aspect-[5/7]"
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: SPIN_DEG }}
            transition={{ duration: SPIN_DURATION, ease: [0.4, 0, 0.2, 1] }}
            onAnimationComplete={onComplete}
          >
            {/* Back face: ? */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            >
              <div className={CHARACTER_CARD_PORTRAIT_SHELL}>
                <CharacterPortraitSlot size="card">
                  <span className="text-5xl font-bold text-straw">?</span>
                </CharacterPortraitSlot>
              </div>
            </div>
            {/* Front face: character (pre-rotated so it reads correctly when parent hits 180°) */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className={CHARACTER_CARD_PORTRAIT_SHELL}>
                <CharacterPortrait
                  name={name}
                  imageUrl={character.image_url}
                  size="card"
                  initialsClassName="text-3xl"
                  previewPlacement="below"
                />
              </div>
            </div>
          </motion.div>
        </div>
        <motion.p
          className="mt-4 font-bold text-xl text-parchment"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: SPIN_DURATION * 0.85 }}
        >
          {name}
        </motion.p>
      </div>
    </div>
  );
}

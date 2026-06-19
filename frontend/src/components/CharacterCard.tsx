import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Character } from '../api/client';
import { characterName } from '../i18n';
import { CharacterPortrait, CharacterPortraitSlot, CHARACTER_CARD_PORTRAIT_SHELL } from './CharacterPortrait';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface CharacterCardProps {
  character?: Character | null;
  displayName?: string;
  isSelf?: boolean;
  language: string;
  revealed?: boolean;
  revealSkipped?: boolean;
  onRevealComplete?: () => void;
}

export function CharacterCard({
  character,
  displayName,
  isSelf = false,
  language,
  revealed = false,
  revealSkipped = false,
  onRevealComplete,
}: CharacterCardProps) {
  const hidden = isSelf && !revealed;
  const reducedMotion = useReducedMotion();
  const prevRevealedRef = useRef(revealed);
  const [isFlipping, setIsFlipping] = useState(false);
  const [showGlow, setShowGlow] = useState(false);

  useEffect(() => {
    if (!prevRevealedRef.current && revealed && isSelf) {
      if (reducedMotion) {
        onRevealComplete?.();
        return;
      }
      setIsFlipping(true);
      const glowTimer = setTimeout(() => setShowGlow(true), 400);
      const flipTimer = setTimeout(() => {
        setIsFlipping(false);
        onRevealComplete?.();
      }, 800);
      const glowOff = setTimeout(() => setShowGlow(false), 2000);
      return () => {
        clearTimeout(glowTimer);
        clearTimeout(flipTimer);
        clearTimeout(glowOff);
      };
    }
    prevRevealedRef.current = revealed;
  }, [revealed, isSelf, reducedMotion, onRevealComplete]);

  const cardClass = clsx(
    'relative w-full rounded-2xl border-2 p-4 text-center transition-all',
    hidden
      ? 'border-straw/40 bg-ocean/80'
      : revealSkipped
        ? 'border-red-400/50 bg-gradient-to-b from-red-900/20 to-ocean/40'
        : 'border-straw bg-gradient-to-b from-parchment/20 to-ocean/40',
    showGlow && !revealSkipped && 'shadow-[0_0_24px_rgba(251,191,36,0.5)]',
    showGlow && revealSkipped && 'shadow-[0_0_16px_rgba(239,68,68,0.3)]'
  );

  const portraitContent = hidden ? (
    <CharacterPortraitSlot size="card">
      <span className="text-4xl font-bold text-straw">?</span>
    </CharacterPortraitSlot>
  ) : character ? (
    <CharacterPortrait
      name={characterName(character, language)}
      imageUrl={character.image_url}
      size="card"
      initialsClassName="text-2xl"
      previewPlacement="below"
    />
  ) : (
    <CharacterPortraitSlot size="card">
      <span className="text-2xl text-parchment/50">—</span>
    </CharacterPortraitSlot>
  );

  const nameLabel = hidden ? '???' : character ? characterName(character, language) : '—';

  if (isSelf && isFlipping && !reducedMotion) {
    return (
      <motion.div layout className={cardClass} style={{ perspective: 800 }}>
        {displayName && (
          <p className="text-sm text-straw/80 mb-2 font-medium">{displayName}</p>
        )}
        <motion.div
          className="flex w-full justify-center"
          initial={{ rotateY: 0 }}
          animate={{ rotateY: 180 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div
            className={CHARACTER_CARD_PORTRAIT_SHELL}
            style={{ backfaceVisibility: 'hidden', position: 'absolute' }}
          >
            <CharacterPortraitSlot size="card">
              <span className="text-4xl font-bold text-straw">?</span>
            </CharacterPortraitSlot>
          </div>
          <div
            className={CHARACTER_CARD_PORTRAIT_SHELL}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {portraitContent}
          </div>
        </motion.div>
        <motion.p
          className="mt-3 font-bold text-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {nameLabel}
        </motion.p>
      </motion.div>
    );
  }

  return (
    <motion.div layout className={cardClass}>
      {displayName && (
        <p className="text-sm text-straw/80 mb-2 font-medium">{displayName}</p>
      )}
      <motion.div
        className="flex w-full justify-center"
        animate={hidden && !reducedMotion ? { rotateY: [0, 10, -10, 0] } : {}}
        transition={{ repeat: hidden ? Infinity : 0, duration: 3 }}
      >
        <div className={CHARACTER_CARD_PORTRAIT_SHELL}>{portraitContent}</div>
      </motion.div>
      <p className="mt-3 font-bold text-lg">{nameLabel}</p>
    </motion.div>
  );
}

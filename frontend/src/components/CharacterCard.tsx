import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Character } from '../api/client';
import { characterName } from '../i18n';
import { CharacterPortrait, CharacterPortraitSlot, CHARACTER_CARD_PORTRAIT_SHELL } from './CharacterPortrait';

interface CharacterCardProps {
  character?: Character | null;
  displayName?: string;
  isSelf?: boolean;
  language: string;
  revealed?: boolean;
  revealSkipped?: boolean;
}

export function CharacterCard({
  character,
  displayName,
  isSelf = false,
  language,
  revealed = false,
  revealSkipped = false,
}: CharacterCardProps) {
  const hidden = isSelf && !revealed;

  const cardClass = clsx(
    'relative w-full rounded-2xl border-2 p-4 text-center transition-all',
    hidden
      ? 'border-straw/40 bg-ocean/80'
      : revealSkipped
        ? 'border-red-400/50 bg-gradient-to-b from-red-900/20 to-ocean/40'
        : 'border-straw bg-gradient-to-b from-parchment/20 to-ocean/40'
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

  return (
    <motion.div layout className={cardClass}>
      {displayName && (
        <p className="text-sm text-straw/80 mb-2 font-medium">{displayName}</p>
      )}
      <div className="flex w-full justify-center">
        <div className={CHARACTER_CARD_PORTRAIT_SHELL}>{portraitContent}</div>
      </div>
      <p className="mt-3 font-bold text-lg">{nameLabel}</p>
    </motion.div>
  );
}

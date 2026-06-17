import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Character } from '../api/client';
import { characterName } from '../i18n';
import { CharacterPortrait, CharacterPortraitSlot } from './CharacterPortrait';

interface CharacterCardProps {
  character?: Character | null;
  displayName?: string;
  isSelf?: boolean;
  language: string;
  revealed?: boolean;
}

export function CharacterCard({
  character,
  displayName,
  isSelf = false,
  language,
  revealed = false,
}: CharacterCardProps) {
  const hidden = isSelf && !revealed;

  return (
    <motion.div
      layout
      className={clsx(
        'relative rounded-2xl border-2 p-4 text-center transition-all',
        hidden
          ? 'border-straw/40 bg-ocean/80'
          : 'border-straw bg-gradient-to-b from-parchment/20 to-ocean/40'
      )}
    >
      {displayName && (
        <p className="text-sm text-straw/80 mb-2 font-medium">{displayName}</p>
      )}
      <motion.div
        className="flex justify-center"
        animate={hidden ? { rotateY: [0, 10, -10, 0] } : {}}
        transition={{ repeat: hidden ? Infinity : 0, duration: 3 }}
      >
        {hidden ? (
          <CharacterPortraitSlot size="lg">
            <span className="text-4xl font-bold text-straw">?</span>
          </CharacterPortraitSlot>
        ) : character ? (
          <CharacterPortrait
            name={characterName(character, language)}
            imageUrl={character.image_url}
            size="lg"
            initialsClassName="text-2xl"
            previewPlacement="below"
          />
        ) : (
          <CharacterPortraitSlot size="lg">
            <span className="text-2xl text-parchment/50">—</span>
          </CharacterPortraitSlot>
        )}
      </motion.div>
      <p className="mt-3 font-bold text-lg">
        {hidden
          ? '???'
          : character
            ? characterName(character, language)
            : '—'}
      </p>
    </motion.div>
  );
}

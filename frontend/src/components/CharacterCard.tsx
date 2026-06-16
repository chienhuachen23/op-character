import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { Character } from '../api/client';
import { resolveMediaUrl } from '../api/client';
import { characterName } from '../i18n';

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
        className="w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-straw/50 flex items-center justify-center bg-ocean"
        animate={hidden ? { rotateY: [0, 10, -10, 0] } : {}}
        transition={{ repeat: hidden ? Infinity : 0, duration: 3 }}
      >
        {hidden ? (
          <span className="text-4xl font-bold text-straw">?</span>
        ) : character ? (
          <CharacterAvatar character={character} language={language} />
        ) : (
          <span className="text-2xl text-parchment/50">—</span>
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

function CharacterAvatar({ character, language }: { character: Character; language: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = characterName(character, language).slice(0, 2);
  const hue = (character.id * 47) % 360;
  const src = character.image_url ? resolveMediaUrl(character.image_url) : '';

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={characterName(character, language)}
        className="w-full h-full object-cover"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
      style={{ background: `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${hue}, 70%, 25%))` }}
    >
      {initials}
    </div>
  );
}

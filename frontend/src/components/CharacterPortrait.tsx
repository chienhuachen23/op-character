import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { resolveMediaUrl } from '../api/client';

/** Trading-card style frame (~5:7, matches One Piece TCG uploads). */
export const CHARACTER_PORTRAIT_FRAME =
  'rounded-xl overflow-hidden border-2 border-straw/40 bg-ocean aspect-[5/7]';

const SIZE_WIDTH = {
  sm: 'w-16',
  md: 'w-20',
  lg: 'w-24',
} as const;

const PREVIEW_WIDTH = {
  sm: 'w-32',
  md: 'w-40',
  lg: 'w-48',
} as const;

type PortraitSize = keyof typeof SIZE_WIDTH;

interface CharacterPortraitProps {
  name: string;
  imageUrl?: string;
  size?: PortraitSize;
  className?: string;
  dashed?: boolean;
  hint?: string;
  initialsClassName?: string;
  hoverPreview?: boolean;
}

export function CharacterPortrait({
  name,
  imageUrl,
  size = 'md',
  className,
  dashed = false,
  hint,
  initialsClassName,
  hoverPreview = true,
}: CharacterPortraitProps) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl ? resolveMediaUrl(imageUrl) : '';
  const hue = ((name.charCodeAt(0) || 0) * 47) % 360;
  const showImage = Boolean(src && !failed);
  const showHoverPreview = hoverPreview && showImage;

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  return (
    <div className={clsx('relative inline-block group', showHoverPreview && 'cursor-zoom-in')}>
      <div
        className={clsx(
          CHARACTER_PORTRAIT_FRAME,
          SIZE_WIDTH[size],
          dashed && 'border-dashed bg-ocean/40',
          className
        )}
      >
        {showImage ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover object-center"
            onError={() => setFailed(true)}
          />
        ) : (
          <div
            className={clsx(
              'w-full h-full flex items-center justify-center text-center font-bold text-white px-2',
              hint ? 'text-xs text-parchment/70' : 'text-xl',
              initialsClassName
            )}
            style={
              hint
                ? undefined
                : {
                    background: `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${hue}, 70%, 25%))`,
                  }
            }
          >
            {hint ?? name.slice(0, 2)}
          </div>
        )}
      </div>
      {showHoverPreview && (
        <div
          className={clsx(
            'pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 -translate-x-1/2',
            'opacity-0 scale-95 transition-all duration-150',
            'group-hover:opacity-100 group-hover:scale-100',
            PREVIEW_WIDTH[size]
          )}
          aria-hidden
        >
          <div className={clsx(CHARACTER_PORTRAIT_FRAME, 'border-straw shadow-2xl shadow-black/40 bg-ocean')}>
            <img src={src} alt="" className="w-full h-full object-cover object-center" />
          </div>
        </div>
      )}
    </div>
  );
}

interface CharacterPortraitSlotProps {
  size?: PortraitSize;
  className?: string;
  dashed?: boolean;
  children: ReactNode;
}

export function CharacterPortraitSlot({
  size = 'md',
  className,
  dashed = false,
  children,
}: CharacterPortraitSlotProps) {
  return (
    <div
      className={clsx(
        CHARACTER_PORTRAIT_FRAME,
        SIZE_WIDTH[size],
        dashed && 'border-dashed bg-ocean/40',
        'flex items-center justify-center',
        className
      )}
    >
      {children}
    </div>
  );
}

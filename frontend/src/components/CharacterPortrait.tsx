import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  sm: 'w-56',
  md: 'w-72',
  lg: 'w-80',
} as const;

const PREVIEW_WIDTH_PX = {
  sm: 224,
  md: 288,
  lg: 320,
} as const;

type PortraitSize = keyof typeof SIZE_WIDTH;
type PreviewStrategy = 'inline' | 'fixed';

interface CharacterPortraitProps {
  name: string;
  imageUrl?: string;
  size?: PortraitSize;
  className?: string;
  dashed?: boolean;
  hint?: string;
  initialsClassName?: string;
  hoverPreview?: boolean;
  previewStrategy?: PreviewStrategy;
}

function PortraitHoverPreview({
  src,
  size,
  anchorRect,
}: {
  src: string;
  size: PortraitSize;
  anchorRect: DOMRect;
}) {
  const width = PREVIEW_WIDTH_PX[size];
  const height = (width * 7) / 5;
  const gap = 10;
  const showAbove = anchorRect.top >= height + gap + 12;
  const left = anchorRect.left + anchorRect.width / 2;
  const top = showAbove ? anchorRect.top - gap : anchorRect.bottom + gap;
  const transform = showAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';

  return createPortal(
    <div
      className="pointer-events-none fixed z-[100]"
      style={{ left, top, transform, width }}
      aria-hidden
    >
      <div
        className={clsx(
          CHARACTER_PORTRAIT_FRAME,
          'border-straw shadow-2xl shadow-black/50 bg-ocean'
        )}
      >
        <img src={src} alt="" className="w-full h-full object-cover object-center" />
      </div>
    </div>,
    document.body
  );
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
  previewStrategy = 'inline',
}: CharacterPortraitProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fixedPreviewRect, setFixedPreviewRect] = useState<DOMRect | null>(null);
  const [failed, setFailed] = useState(false);
  const src = imageUrl ? resolveMediaUrl(imageUrl) : '';
  const hue = ((name.charCodeAt(0) || 0) * 47) % 360;
  const showImage = Boolean(src && !failed);
  const showHoverPreview = hoverPreview && showImage;
  const useFixedPreview = showHoverPreview && previewStrategy === 'fixed';

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const showFixedPreview = () => {
    if (!rootRef.current) return;
    setFixedPreviewRect(rootRef.current.getBoundingClientRect());
  };

  const hideFixedPreview = () => {
    setFixedPreviewRect(null);
  };

  return (
    <div
      ref={rootRef}
      className={clsx('relative inline-block group', showHoverPreview && 'cursor-zoom-in')}
      onMouseEnter={useFixedPreview ? showFixedPreview : undefined}
      onMouseLeave={useFixedPreview ? hideFixedPreview : undefined}
    >
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
      {showHoverPreview && previewStrategy === 'inline' && (
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
      {useFixedPreview && fixedPreviewRect && (
        <PortraitHoverPreview src={src} size={size} anchorRect={fixedPreviewRect} />
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

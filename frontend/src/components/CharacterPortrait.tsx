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
  card: 'w-4/5',
} as const;

const PREVIEW_WIDTH_PX = {
  sm: 224,
  md: 288,
  lg: 320,
  card: 320,
} as const;

type PortraitSize = keyof typeof SIZE_WIDTH;
type PreviewStrategy = 'inline' | 'fixed';
type PreviewPlacement = 'above' | 'below' | 'auto';

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
  previewPlacement?: PreviewPlacement;
}

function usePrefersHoverPreview(): boolean {
  const [prefersHover, setPrefersHover] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
      : true
  );

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const onChange = () => setPrefersHover(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return prefersHover;
}

function resolvePreviewPlacement(
  anchorRect: DOMRect,
  previewHeight: number,
  placement: PreviewPlacement
): 'above' | 'below' {
  const gap = 10;
  const padding = 12;
  const spaceAbove = anchorRect.top;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const needed = previewHeight + gap + padding;

  if (placement === 'below') return 'below';
  if (placement === 'above') return 'above';
  if (spaceAbove < needed) return 'below';
  if (spaceBelow < needed) return 'above';
  return 'below';
}

function PortraitHoverPreview({
  src,
  size,
  anchorRect,
  placement,
}: {
  src: string;
  size: PortraitSize;
  anchorRect: DOMRect;
  placement: PreviewPlacement;
}) {
  const width = PREVIEW_WIDTH_PX[size];
  const height = (width * 7) / 5;
  const gap = 10;
  const edgePadding = 8;
  const side = resolvePreviewPlacement(anchorRect, height, placement);
  const left = Math.min(
    window.innerWidth - edgePadding,
    Math.max(edgePadding, anchorRect.left + anchorRect.width / 2)
  );
  const top = side === 'above' ? anchorRect.top - gap : anchorRect.bottom + gap;
  const transform = side === 'above' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';

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
  previewPlacement = 'auto',
}: CharacterPortraitProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersHoverPreview = usePrefersHoverPreview();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRect, setPreviewRect] = useState<DOMRect | null>(null);
  const [failed, setFailed] = useState(false);
  const src = imageUrl ? resolveMediaUrl(imageUrl) : '';
  const hue = ((name.charCodeAt(0) || 0) * 47) % 360;
  const showImage = Boolean(src && !failed);
  const showHoverPreview = hoverPreview && showImage;
  const usePortalPreview = showHoverPreview && (previewStrategy === 'fixed' || previewStrategy === 'inline');

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const syncPreviewRect = () => {
    if (!rootRef.current) return;
    setPreviewRect(rootRef.current.getBoundingClientRect());
  };

  const openPreview = () => {
    syncPreviewRect();
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewRect(null);
  };

  const togglePreview = () => {
    if (previewOpen) {
      closePreview();
      return;
    }
    openPreview();
  };

  useEffect(() => {
    if (!previewOpen || prefersHoverPreview) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closePreview();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [previewOpen, prefersHoverPreview]);

  useEffect(() => {
    if (!previewOpen) return;

    const onViewportChange = () => syncPreviewRect();
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    return () => {
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [previewOpen]);

  return (
    <div
      ref={rootRef}
      className={clsx('relative inline-block', showHoverPreview && 'cursor-zoom-in')}
      onMouseEnter={showHoverPreview && prefersHoverPreview ? openPreview : undefined}
      onMouseLeave={showHoverPreview && prefersHoverPreview ? closePreview : undefined}
      onClick={
        showHoverPreview && !prefersHoverPreview
          ? (event) => {
              event.stopPropagation();
              togglePreview();
            }
          : undefined
      }
      onKeyDown={
        showHoverPreview && !prefersHoverPreview
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                togglePreview();
              }
            }
          : undefined
      }
      role={showHoverPreview && !prefersHoverPreview ? 'button' : undefined}
      tabIndex={showHoverPreview && !prefersHoverPreview ? 0 : undefined}
      aria-label={showHoverPreview && !prefersHoverPreview ? name : undefined}
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
      {usePortalPreview && previewOpen && previewRect && (
        <PortraitHoverPreview
          src={src}
          size={size}
          anchorRect={previewRect}
          placement={previewPlacement}
        />
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

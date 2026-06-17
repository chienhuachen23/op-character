import clsx from 'clsx';
import type { AdminCharacterImage } from '../../api/adminClient';
import { resolveMediaUrl } from '../../api/client';
import { CHARACTER_PORTRAIT_FRAME } from '../../components/CharacterPortrait';

const STACK_LAYERS = [
  { rotate: -7, x: -6, y: 4, scale: 0.92, opacity: 0.75 },
  { rotate: 5, x: 5, y: -3, scale: 0.96, opacity: 0.88 },
  { rotate: 0, x: 0, y: 0, scale: 1, opacity: 1 },
] as const;

interface AdminCharacterImageStackProps {
  name: string;
  images: AdminCharacterImage[];
  onOpenGallery: () => void;
  className?: string;
}

export function AdminCharacterImageStack({
  name,
  images,
  onOpenGallery,
  className,
}: AdminCharacterImageStackProps) {
  const count = images.length;
  const firstSrc = count > 0 ? resolveMediaUrl(images[0].image_url) : '';
  const hue = ((name.charCodeAt(0) || 0) * 47) % 360;

  if (count === 0) {
    return (
      <button
        type="button"
        onClick={onOpenGallery}
        className={clsx('relative inline-block', className)}
        aria-label={name}
      >
        <div
          className={clsx(
            CHARACTER_PORTRAIT_FRAME,
            'w-20 border-dashed bg-ocean/40 flex items-center justify-center text-xl font-bold text-white'
          )}
          style={{
            background: `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${hue}, 70%, 25%))`,
          }}
        >
          {name.slice(0, 2)}
        </div>
      </button>
    );
  }

  if (count === 1) {
    const src = resolveMediaUrl(images[0].image_url);
    return (
      <button
        type="button"
        onClick={onOpenGallery}
        className={clsx('relative inline-block group cursor-pointer', className)}
        aria-label={name}
      >
        <div className={clsx(CHARACTER_PORTRAIT_FRAME, 'w-20 bg-ocean')}>
          <img src={src} alt={name} className="w-full h-full object-cover object-center" />
        </div>
        <div
          className={clsx(
            'pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-40 -translate-x-1/2',
            'opacity-0 scale-95 transition-all duration-150',
            'group-hover:opacity-100 group-hover:scale-100'
          )}
          aria-hidden
        >
          <div className={clsx(CHARACTER_PORTRAIT_FRAME, 'border-straw shadow-2xl shadow-black/40 bg-ocean')}>
            <img src={src} alt="" className="w-full h-full object-cover object-center" />
          </div>
        </div>
      </button>
    );
  }

  const visible = images.slice(0, 3);
  const layers = visible
    .map((image, index) => ({
      image,
      style: STACK_LAYERS[STACK_LAYERS.length - visible.length + index],
    }))
    .reverse();

  return (
    <button
      type="button"
      onClick={onOpenGallery}
      className={clsx('relative inline-block group cursor-pointer', className)}
      aria-label={name}
    >
      <div className="relative w-20 h-[6.65rem]">
        {layers.map(({ image, style }, layerIndex) => (
          <div
            key={image.id}
            className={clsx(CHARACTER_PORTRAIT_FRAME, 'absolute inset-0 w-20 bg-ocean shadow-lg')}
            style={{
              transform: `translate(${style.x}px, ${style.y}px) rotate(${style.rotate}deg) scale(${style.scale})`,
              opacity: style.opacity,
              zIndex: layerIndex + 1,
            }}
          >
            <img
              src={resolveMediaUrl(image.image_url)}
              alt=""
              className="w-full h-full object-cover object-center"
            />
          </div>
        ))}
      </div>

      <span className="absolute -top-1.5 -right-1.5 z-20 min-w-6 h-6 px-1.5 rounded-full bg-straw text-wood text-xs font-bold flex items-center justify-center shadow-md border-2 border-ocean">
        {count}
      </span>

      {firstSrc && (
        <div
          className={clsx(
            'pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-40 -translate-x-1/2',
            'opacity-0 scale-95 transition-all duration-150',
            'group-hover:opacity-100 group-hover:scale-100'
          )}
          aria-hidden
        >
          <div className={clsx(CHARACTER_PORTRAIT_FRAME, 'border-straw shadow-2xl shadow-black/40 bg-ocean')}>
            <img src={firstSrc} alt="" className="w-full h-full object-cover object-center" />
          </div>
        </div>
      )}
    </button>
  );
}

import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { AdminCharacter } from '../../api/adminClient';
import { Modal } from '../../components/ui';
import { CharacterPortrait } from '../../components/CharacterPortrait';
import { characterName } from '../../i18n';
import { usableCharacterImages } from './characterFilters';

interface AdminCharacterGalleryModalProps {
  character: AdminCharacter | null;
  language: string;
  loading: boolean;
  highlightImageId?: number | null;
  onClose: () => void;
  onDeleteImage: (characterId: number, imageId: number) => void;
  onAddImage: (characterId: number) => void;
}

export function AdminCharacterGalleryModal({
  character,
  language,
  loading,
  highlightImageId,
  onClose,
  onDeleteImage,
  onAddImage,
}: AdminCharacterGalleryModalProps) {
  const { t } = useTranslation();
  if (!character) return null;

  const displayName = characterName(character, language);
  const images = usableCharacterImages(character);

  return (
    <Modal
      open
      onClose={onClose}
      title={t('adminImageGalleryTitle', { name: displayName })}
      className="max-w-2xl"
    >
      <p className="text-sm text-parchment/60 mb-4">
        {t('adminImageGalleryHint', { count: images.length })}
      </p>

      {images.length === 0 ? (
        <p className="text-center text-parchment/50 py-8">{t('adminNoImagesYet')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {images.map((image) => (
            <div key={image.id} className="relative flex justify-center">
              <CharacterPortrait
                imageUrl={image.image_url}
                name={displayName}
                size="md"
                previewStrategy="fixed"
                className={clsx(highlightImageId === image.id && 'ring-2 ring-green-400')}
              />
              <button
                type="button"
                className="absolute top-0 right-2 w-6 h-6 rounded-full bg-red-600 text-white text-sm leading-none hover:bg-red-500 shadow-md disabled:opacity-50"
                disabled={loading}
                onClick={() => onDeleteImage(character.id, image.id)}
                aria-label={t('delete')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          className="px-4 py-2 rounded-xl border border-straw/40 text-sm hover:bg-white/10 transition-colors"
          disabled={loading}
          onClick={() => onAddImage(character.id)}
        >
          {t('adminAddImage')}
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-straw text-wood text-sm font-semibold hover:bg-straw-dark transition-colors"
          onClick={onClose}
        >
          {t('close')}
        </button>
      </div>
    </Modal>
  );
}

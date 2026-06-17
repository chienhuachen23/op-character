import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  adminApi,
  type AdminCharacter,
  type AdminTheme,
} from '../../api/adminClient';
import { Card, Button, Input } from '../../components/ui';
import { CharacterPortrait } from '../../components/CharacterPortrait';
import { characterName } from '../../i18n';
import {
  exportCharacterTemplateCsv,
  exportCharactersCsv,
  parseCharacterCsv,
} from './characterCsv';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']);

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
  return IMAGE_EXTENSIONS.has(ext);
}

function acceptsFileDrop(e: DragEvent): boolean {
  const types = e.dataTransfer.types;
  return types.includes('Files') || types.some((type) => type.startsWith('image/'));
}

function PendingImagePreview({ file, alt }: { file: File; alt: string }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!src) return null;

  return (
    <div className="w-20 aspect-[5/7] rounded-xl overflow-hidden border-2 border-straw/40 bg-ocean">
      <img src={src} alt={alt} className="w-full h-full object-cover" />
    </div>
  );
}

export function AdminThemeDetailPage() {
  const { themeId } = useParams<{ themeId: string }>();
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadCharacterId = useRef<number | null>(null);
  const [theme, setTheme] = useState<AdminTheme | null>(null);
  const [characters, setCharacters] = useState<AdminCharacter[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);
  const [dragOverCharacterId, setDragOverCharacterId] = useState<number | null>(null);
  const [dragOverCreateForm, setDragOverCreateForm] = useState(false);
  const [pendingCreateImage, setPendingCreateImage] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name_zh: '',
    name_en: '',
    is_active: true,
  });

  const id = Number(themeId);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [themeData, characterData] = await Promise.all([
        adminApi.listThemes().then((themes) => themes.find((item) => item.id === id) ?? null),
        adminApi.listCharacters(id),
      ]);
      setTheme(themeData);
      setCharacters(characterData);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const preventDefault = (e: globalThis.DragEvent) => e.preventDefault();
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ name_zh: '', name_en: '', is_active: true });
    setPendingCreateImage(null);
    setDragOverCreateForm(false);
  };

  const startCreate = () => {
    resetForm();
    setEditingId(0);
  };

  const startEdit = (character: AdminCharacter) => {
    setEditingId(character.id);
    setPendingCreateImage(null);
    setDragOverCreateForm(false);
    setForm({
      name_zh: character.name_zh,
      name_en: character.name_en,
      is_active: character.is_active,
    });
  };

  const handleSave = async () => {
    if (!form.name_zh.trim() || !form.name_en.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (editingId === 0) {
        const created = await adminApi.createCharacter(id, {
          name_zh: form.name_zh.trim(),
          name_en: form.name_en.trim(),
          is_active: form.is_active,
        });
        if (pendingCreateImage) {
          await uploadImageForCharacter(pendingCreateImage, created.id);
        }
      } else if (editingId) {
        await adminApi.updateCharacter(editingId, {
          name_zh: form.name_zh.trim(),
          name_en: form.name_en.trim(),
          is_active: form.is_active,
        });
      }
      resetForm();
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (characterId: number) => {
    if (!window.confirm(t('adminDeleteCharacterConfirm'))) return;
    setLoading(true);
    try {
      await adminApi.deleteCharacter(characterId);
      if (editingId === characterId) resetForm();
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const uploadImageForCharacter = async (file: File, characterId: number): Promise<string> => {
    if (!theme) {
      throw new Error('Theme not loaded');
    }
    if (!isImageFile(file)) {
      throw new Error(t('adminInvalidImageFile'));
    }
    const { url } = await adminApi.uploadImage(file, theme.slug);
    await adminApi.updateCharacter(characterId, { image_url: url });
    return url;
  };

  const handleUpload = async (file: File, characterId: number) => {
    if (!theme) return;
    const character = characters.find((item) => item.id === characterId);
    setLoading(true);
    setUploadTargetId(characterId);
    setError('');
    setUploadMessage('');
    setImportMessage('');
    try {
      const url = await uploadImageForCharacter(file, characterId);
      const displayName = character ? characterName(character, lang) : '';
      setCharacters((prev) =>
        prev.map((item) => (item.id === characterId ? { ...item, image_url: url } : item))
      );
      if (displayName) {
        setUploadMessage(t('adminUploadSuccess', { name: displayName }));
      }
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadTargetId(null);
      setLoading(false);
    }
  };

  const handleCreateFormDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!acceptsFileDrop(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverCreateForm(true);
  };

  const handleCreateFormDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setDragOverCreateForm(false);
    }
  };

  const handleCreateFormDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverCreateForm(false);
    const file = Array.from(e.dataTransfer.files).find(isImageFile);
    if (!file) {
      setError(t('adminInvalidImageFile'));
      return;
    }
    setPendingCreateImage(file);
    setError('');
  };

  const handleExport = () => {
    if (!theme) return;
    if (!characters.length) {
      setError(t('adminExportEmpty'));
      return;
    }
    exportCharactersCsv(characters, theme.slug);
    setImportMessage('');
    setUploadMessage('');
  };

  const handleDownloadTemplate = () => {
    if (!theme) return;
    exportCharacterTemplateCsv(theme.slug);
  };

  const handleImportFile = async (file: File) => {
    setLoading(true);
    setError('');
    setImportMessage('');
    setUploadMessage('');
    try {
      const text = await file.text();
      const rows = parseCharacterCsv(text);
      if (!rows.length) {
        setError(t('adminImportEmpty'));
        return;
      }
      const result = await adminApi.importCharacters(id, rows);
      const messages = [t('adminImportResult', { count: result.created })];
      if (result.skipped > 0) {
        messages.push(t('adminImportSkipped', { count: result.skipped }));
      }
      setImportMessage(messages.join(' · '));
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCardDragOver = (e: DragEvent<HTMLDivElement>, characterId: number) => {
    if (!acceptsFileDrop(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverCharacterId(characterId);
  };

  const handleCardDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setDragOverCharacterId(null);
    }
  };

  const handleCardDrop = (e: DragEvent<HTMLDivElement>, characterId: number) => {
    e.preventDefault();
    setDragOverCharacterId(null);
    if (loading) return;

    const file = Array.from(e.dataTransfer.files).find(isImageFile);
    if (!file) {
      setError(t('adminInvalidImageFile'));
      return;
    }
    void handleUpload(file, characterId);
  };

  const lang = i18n.language;

  if (!theme && !error) {
    return <p className="text-center py-12">{t('loading')}</p>;
  }

  return (
    <div>
      <Link to="/admin/themes" className="text-sm text-straw hover:underline">
        ← {t('adminBackThemes')}
      </Link>

      {theme && (
        <div className="mt-4 mb-6">
          <h2 className="text-2xl font-bold text-straw">{theme.name_zh}</h2>
          <p className="text-parchment/70">{theme.name_en}</p>
          <p className="text-sm text-parchment/50 mt-2">{t('adminDropImagePageHint')}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={startCreate}>{t('adminNewCharacter')}</Button>
        <Button variant="secondary" onClick={handleExport} disabled={loading || !characters.length}>
          {t('adminExportCharacters')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => importInputRef.current?.click()}
          disabled={loading}
        >
          {t('adminImportCharacters')}
        </Button>
        <Button variant="ghost" onClick={handleDownloadTemplate} disabled={!theme}>
          {t('adminDownloadTemplate')}
        </Button>
      </div>

      {editingId !== null && (
        <div
          onDragEnter={editingId === 0 ? handleCreateFormDragOver : undefined}
          onDragOver={editingId === 0 ? handleCreateFormDragOver : undefined}
          onDragLeave={editingId === 0 ? handleCreateFormDragLeave : undefined}
          onDrop={editingId === 0 ? handleCreateFormDrop : undefined}
        >
          <Card
            className={clsx(
              'mb-6 relative',
              editingId === 0 && dragOverCreateForm && 'ring-2 ring-straw shadow-straw/30 shadow-lg'
            )}
          >
          {editingId === 0 && dragOverCreateForm && (
            <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-straw bg-straw/15 flex items-center justify-center pointer-events-none">
              <p className="text-sm font-semibold text-straw px-4 text-center">
                {t('adminDropImageHint')}
              </p>
            </div>
          )}
          <h3 className="font-bold mb-4">
            {editingId === 0 ? t('adminNewCharacter') : t('adminEditCharacter')}
          </h3>
          {editingId === 0 && (
            <div className="flex flex-col items-center mb-4">
              {pendingCreateImage ? (
                <PendingImagePreview
                  file={pendingCreateImage}
                  alt={form.name_zh || form.name_en || 'preview'}
                />
              ) : (
                <CharacterPortrait
                  name={form.name_zh || form.name_en || 'new'}
                  size="md"
                  dashed
                  hint={t('adminCreateDropImageHint')}
                />
              )}
              {pendingCreateImage && (
                <button
                  type="button"
                  className="text-xs text-parchment/60 mt-2 hover:text-parchment"
                  onClick={() => setPendingCreateImage(null)}
                >
                  {t('cancel')}
                </button>
              )}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <Input
              value={form.name_zh}
              onChange={(e) => setForm((prev) => ({ ...prev, name_zh: e.target.value }))}
              placeholder={t('adminCharacterNameZh')}
            />
            <Input
              value={form.name_en}
              onChange={(e) => setForm((prev) => ({ ...prev, name_en: e.target.value }))}
              placeholder={t('adminCharacterNameEn')}
            />
          </div>
          <p className="text-sm text-parchment/50 mb-4">{t('adminImageOnCardHint')}</p>
          <label className="flex items-center gap-2 text-sm mb-4">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            {t('adminCharacterActive')}
          </label>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? t('loading') : t('save')}
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              {t('cancel')}
            </Button>
          </div>
          </Card>
        </div>
      )}

      {error && <p className="text-red-400 mb-4">{error}</p>}
      {uploadMessage && <p className="text-green-300 mb-4">{uploadMessage}</p>}
      {importMessage && <p className="text-green-300 mb-4">{importMessage}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const targetId = pendingUploadCharacterId.current;
          e.target.value = '';
          pendingUploadCharacterId.current = null;
          if (file && targetId) {
            void handleUpload(file, targetId);
          }
        }}
      />

      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) {
            void handleImportFile(file);
          }
        }}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map((character) => {
          const displayName = characterName(character, lang);
          const isDragOver = dragOverCharacterId === character.id;
          const isUploading = loading && uploadTargetId === character.id;
          const portraitKey = `${character.id}:${character.image_url}`;
          return (
            <div
              key={character.id}
              onDragEnter={(e) => handleCardDragOver(e, character.id)}
              onDragOver={(e) => handleCardDragOver(e, character.id)}
              onDragLeave={handleCardDragLeave}
              onDrop={(e) => handleCardDrop(e, character.id)}
            >
              <Card
                className={clsx(
                  'relative transition-shadow h-full',
                  !character.is_active && 'opacity-50',
                  isDragOver && 'ring-2 ring-straw shadow-straw/30 shadow-lg'
                )}
              >
              {isDragOver && (
                <div className="absolute inset-0 z-10 rounded-2xl border-2 border-dashed border-straw bg-straw/15 flex items-center justify-center pointer-events-none">
                  <p className="text-sm font-semibold text-straw px-4 text-center">
                    {t('adminDropImageHint')}
                  </p>
                </div>
              )}
              {isUploading && !isDragOver && (
                <div className="absolute inset-0 z-10 rounded-2xl bg-ocean/70 flex items-center justify-center pointer-events-none">
                  <p className="text-sm font-medium text-straw">{t('loading')}</p>
                </div>
              )}
              <div className="flex flex-col items-center text-center">
                <CharacterPortrait
                  key={portraitKey}
                  imageUrl={character.image_url}
                  name={displayName}
                  size="md"
                />
                <p className="font-bold mt-3">{character.name_zh}</p>
                <p className="text-sm text-parchment/70">{character.name_en}</p>
                {!character.is_active && (
                  <p className="text-xs text-red-300 mt-1">{t('adminCharacterInactive')}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button className="flex-1" variant="secondary" onClick={() => startEdit(character)}>
                  {t('edit')}
                </Button>
                <Button
                  className="flex-1"
                  variant="ghost"
                  disabled={isUploading}
                  onClick={() => {
                    pendingUploadCharacterId.current = character.id;
                    fileInputRef.current?.click();
                  }}
                >
                  {isUploading ? t('loading') : t('adminUploadImage')}
                </Button>
                <Button variant="danger" onClick={() => handleDelete(character.id)}>
                  {t('delete')}
                </Button>
              </div>
              </Card>
            </div>
          );
        })}
      </div>

      {characters.length === 0 && !error && (
        <p className="text-center text-parchment/50 py-12">{t('adminNoCharacters')}</p>
      )}
    </div>
  );
}

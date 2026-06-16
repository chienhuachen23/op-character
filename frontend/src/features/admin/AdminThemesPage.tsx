import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi, type AdminTheme } from '../../api/adminClient';
import { Card, Button, Input } from '../../components/ui';

export function AdminThemesPage() {
  const { t } = useTranslation();
  const [themes, setThemes] = useState<AdminTheme[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [slug, setSlug] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [nameEn, setNameEn] = useState('');

  const loadThemes = useCallback(async () => {
    try {
      const data = await adminApi.listThemes();
      setThemes(data);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  const handleCreate = async () => {
    if (!slug.trim() || !nameZh.trim() || !nameEn.trim()) return;
    setLoading(true);
    setError('');
    try {
      await adminApi.createTheme({
        slug: slug.trim(),
        name_zh: nameZh.trim(),
        name_en: nameEn.trim(),
        game_mode: 'trait_guess',
      });
      setSlug('');
      setNameZh('');
      setNameEn('');
      setShowForm(false);
      await loadThemes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold">{t('adminThemes')}</h2>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? t('cancel') : t('adminNewTheme')}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <h3 className="font-bold mb-4">{t('adminNewTheme')}</h3>
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t('adminThemeSlug')}
            />
            <Input
              value={nameZh}
              onChange={(e) => setNameZh(e.target.value)}
              placeholder={t('adminThemeNameZh')}
            />
            <Input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={t('adminThemeNameEn')}
            />
          </div>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? t('loading') : t('adminCreateTheme')}
          </Button>
        </Card>
      )}

      {error && <p className="text-red-400 mb-4">{error}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        {themes.map((theme) => (
          <Link key={theme.id} to={`/admin/themes/${theme.id}`}>
            <Card className="hover:border-straw/60 transition-colors cursor-pointer h-full">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-straw">{theme.name_zh}</h3>
                  <p className="text-parchment/70">{theme.name_en}</p>
                  <p className="text-xs text-parchment/50 mt-2">
                    {theme.slug} · {theme.game_mode_slug}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-straw">{theme.character_count}</p>
                  <p className="text-xs text-parchment/50">{t('adminCharacters')}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {themes.length === 0 && !error && (
        <p className="text-center text-parchment/50 py-12">{t('adminNoThemes')}</p>
      )}
    </div>
  );
}

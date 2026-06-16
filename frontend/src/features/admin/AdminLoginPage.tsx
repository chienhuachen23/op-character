import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminApi, isAdminAuthenticated, setAdminKey } from '../../api/adminClient';
import { Card, Button, Input } from '../../components/ui';

export function AdminLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAdminAuthenticated()) {
    return <Navigate to="/admin/themes" replace />;
  }

  const handleLogin = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setError('');
    try {
      await adminApi.verifyKey(key.trim());
      setAdminKey(key.trim());
      navigate('/admin/themes');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-straw mb-2">{t('adminLoginTitle')}</h1>
        <p className="text-sm text-parchment/60 mb-6">{t('adminLoginHint')}</p>
        <Input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t('adminKeyPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        <Button className="w-full mt-4" onClick={handleLogin} disabled={loading || !key.trim()}>
          {loading ? t('loading') : t('adminLogin')}
        </Button>
        <Button variant="ghost" className="w-full mt-2" onClick={() => navigate('/')}>
          {t('backHome')}
        </Button>
      </Card>
    </div>
  );
}

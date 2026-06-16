import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clearAdminKey, isAdminAuthenticated } from '../../api/adminClient';
import { Button } from '../../components/ui';

export function AdminGuard() {
  if (!isAdminAuthenticated()) {
    return <Navigate to="/admin" replace />;
  }
  return <Outlet />;
}

export function AdminShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAdminKey();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen p-4 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-straw">{t('adminTitle')}</h1>
          <p className="text-parchment/60 text-sm">{t('adminSubtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate('/')}>
            {t('backHome')}
          </Button>
          <Button variant="ghost" onClick={handleLogout}>
            {t('adminLogout')}
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

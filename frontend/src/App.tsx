import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './features/home/HomePage';
import { LobbyPage } from './features/lobby/LobbyPage';
import { GameBoard } from './features/game/GameBoard';
import { ResultsPoster } from './features/results/ResultsPoster';
import { AdminLoginPage } from './features/admin/AdminLoginPage';
import { AdminShell, AdminGuard } from './features/admin/AdminShell';
import { AdminThemesPage } from './features/admin/AdminThemesPage';
import { AdminThemeDetailPage } from './features/admin/AdminThemeDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:code" element={<LobbyPage />} />
        <Route path="/room/:code/play" element={<GameBoard />} />
        <Route path="/room/:code/results" element={<ResultsPoster />} />
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route element={<AdminGuard />}>
          <Route element={<AdminShell />}>
            <Route path="/admin/themes" element={<AdminThemesPage />} />
            <Route path="/admin/themes/:themeId" element={<AdminThemeDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

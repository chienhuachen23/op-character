import { BrowserRouter, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { HomePage } from './features/home/HomePage';
import { LobbyPage } from './features/lobby/LobbyPage';
import { GameBoard } from './features/game/GameBoard';
import { ResultsPoster } from './features/results/ResultsPoster';
import { AdminLoginPage } from './features/admin/AdminLoginPage';
import { AdminShell, AdminGuard } from './features/admin/AdminShell';
import { AdminThemesPage } from './features/admin/AdminThemesPage';
import { AdminThemeDetailPage } from './features/admin/AdminThemeDetailPage';
import { useReducedMotion } from './hooks/useReducedMotion';

function AnimatedRoutes() {
  const location = useLocation();
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reducedMotion ? undefined : { opacity: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        className="min-h-screen"
      >
        <Routes location={location}>
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
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';
import { setUILanguage } from '../i18n';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { usePreferences } from '../hooks/usePreferences';
import { Spinner } from './Spinner';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'rounded-2xl border border-straw/30 bg-ocean/60 backdrop-blur-md shadow-xl p-6',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export function Button({
  children,
  variant = 'primary',
  loading = false,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}) {
  const variants = {
    primary: 'bg-straw text-wood hover:bg-straw-dark font-bold shadow-lg shadow-straw/30',
    secondary: 'bg-ocean-light/80 border border-straw/40 hover:bg-ocean-light',
    danger: 'bg-red-600 hover:bg-red-700',
    ghost: 'bg-transparent border border-parchment/30 hover:bg-white/10',
  };
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]',
        variants[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        'w-full px-4 py-2.5 rounded-xl bg-ocean/80 border border-straw/30 text-parchment placeholder:text-parchment/50 focus:outline-none focus:ring-2 focus:ring-straw/50',
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'w-full px-4 py-2.5 rounded-xl bg-ocean/80 border border-straw/30 text-parchment focus:outline-none focus:ring-2 focus:ring-straw/50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="absolute inset-0 bg-black/60"
            aria-label="Close"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className={clsx(
              'relative z-10 w-full max-w-md rounded-2xl border border-straw/30 bg-ocean/95 backdrop-blur-md shadow-xl p-6 max-h-[90vh] overflow-y-auto',
              className
            )}
          >
            <h3 id="modal-title" className="font-bold text-lg text-straw mb-4 pr-8">
              {title}
            </h3>
            <button
              type="button"
              className="absolute top-4 right-4 text-parchment/60 hover:text-parchment text-xl leading-none"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="flex gap-2">
      {(['zh', 'en'] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => setUILanguage(lang)}
          className={clsx(
            'px-3 py-1 rounded-lg text-sm transition-colors',
            i18n.language === lang ? 'bg-straw text-wood font-bold' : 'bg-white/10 hover:bg-white/20'
          )}
        >
          {lang === 'zh' ? '中文' : 'EN'}
        </button>
      ))}
    </div>
  );
}

export function SfxToggle() {
  const { t } = useTranslation();
  const { sfxEnabled, toggleSfx } = usePreferences();

  return (
    <button
      type="button"
      onClick={toggleSfx}
      className="text-xs text-parchment/50 hover:text-straw transition-colors"
      title={t('settingSound')}
    >
      {sfxEnabled ? `🔊 ${t('soundOn')}` : `🔇 ${t('soundOff')}`}
    </button>
  );
}

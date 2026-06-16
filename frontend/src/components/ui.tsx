import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { setUILanguage } from '../i18n';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
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
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const variants = {
    primary: 'bg-straw text-wood hover:bg-straw-dark font-bold shadow-lg shadow-straw/30',
    secondary: 'bg-ocean-light/80 border border-straw/40 hover:bg-ocean-light',
    danger: 'bg-red-600 hover:bg-red-700',
    ghost: 'bg-transparent border border-parchment/30 hover:bg-white/10',
  };
  return (
    <button
      className={clsx(
        'px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
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

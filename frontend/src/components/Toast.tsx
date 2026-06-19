import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type ToastVariant = 'success' | 'error' | 'info' | 'neutral';

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-green-500/50 bg-green-900/90 text-green-100',
  error: 'border-red-500/50 bg-red-900/90 text-red-100',
  info: 'border-straw/50 bg-ocean/95 text-straw',
  neutral: 'border-parchment/30 bg-ocean/95 text-parchment',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const reducedMotion = useReducedMotion();

  const toast = useCallback((message: string, variant: ToastVariant = 'neutral') => {
    const id = ++nextId;
    setItems((prev) => [...prev.slice(-2), { id, message, variant }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none"
        aria-live="polite"
      >
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 20, scale: 0.95 }}
              transition={{ duration: reducedMotion ? 0 : 0.2 }}
              className={clsx(
                'pointer-events-auto px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md text-sm font-medium',
                variantStyles[item.variant]
              )}
            >
              {item.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

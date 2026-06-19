import { useCallback } from 'react';
import { getHapticEnabled } from './usePreferences';

const PATTERNS = {
  tap: [10],
  success: [30, 50, 30],
  error: [80, 40, 80],
  phase: [20],
} as const;

export type HapticPattern = keyof typeof PATTERNS;

export function useHaptic() {
  const vibrate = useCallback((pattern: HapticPattern) => {
    if (!getHapticEnabled()) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([...PATTERNS[pattern]]);
    }
  }, []);

  return { vibrate };
}

import { useCallback, useSyncExternalStore } from 'react';

const SFX_KEY = 'sfx_enabled';
const HAPTIC_KEY = 'haptic_enabled';

function readBool(key: string, defaultValue: boolean): boolean {
  const v = localStorage.getItem(key);
  if (v === null) return defaultValue;
  return v === 'true';
}

let listeners: Array<() => void> = [];

function emit() {
  listeners.forEach((l) => l());
}

export function getSfxEnabled(): boolean {
  return readBool(SFX_KEY, false);
}

export function getHapticEnabled(): boolean {
  return readBool(HAPTIC_KEY, true);
}

export function setSfxEnabled(enabled: boolean) {
  localStorage.setItem(SFX_KEY, String(enabled));
  emit();
}

export function setHapticEnabled(enabled: boolean) {
  localStorage.setItem(HAPTIC_KEY, String(enabled));
  emit();
}

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export function usePreferences() {
  const sfxEnabled = useSyncExternalStore(subscribe, getSfxEnabled, () => false);
  const hapticEnabled = useSyncExternalStore(subscribe, getHapticEnabled, () => true);

  const toggleSfx = useCallback(() => setSfxEnabled(!getSfxEnabled()), []);
  const toggleHaptic = useCallback(() => setHapticEnabled(!getHapticEnabled()), []);

  return { sfxEnabled, hapticEnabled, toggleSfx, toggleHaptic, setSfxEnabled, setHapticEnabled };
}

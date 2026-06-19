import { useCallback, useEffect, useRef } from 'react';
import { getSfxEnabled } from './usePreferences';

export type SfxName = 'tap' | 'submit' | 'correct' | 'wrong' | 'phase' | 'win' | 'lose';

const SFX_PATHS: Record<SfxName, string> = {
  tap: '/sounds/tap.wav',
  submit: '/sounds/submit.wav',
  correct: '/sounds/correct.wav',
  wrong: '/sounds/wrong.wav',
  phase: '/sounds/phase.wav',
  win: '/sounds/win.wav',
  lose: '/sounds/lose.wav',
};

type Tone = { freq: number; duration: number; type?: OscillatorType; gain?: number };

const SYNTH: Record<SfxName, Tone[]> = {
  tap: [{ freq: 600, duration: 0.04, gain: 0.08 }],
  submit: [
    { freq: 440, duration: 0.06, gain: 0.1 },
    { freq: 660, duration: 0.08, gain: 0.08 },
  ],
  correct: [
    { freq: 523, duration: 0.1, gain: 0.12 },
    { freq: 659, duration: 0.1, gain: 0.12 },
    { freq: 784, duration: 0.15, gain: 0.1 },
  ],
  wrong: [
    { freq: 200, duration: 0.12, gain: 0.12, type: 'sawtooth' },
    { freq: 150, duration: 0.15, gain: 0.1, type: 'sawtooth' },
  ],
  phase: [
    { freq: 330, duration: 0.08, gain: 0.1 },
    { freq: 440, duration: 0.12, gain: 0.08 },
  ],
  win: [
    { freq: 523, duration: 0.1, gain: 0.1 },
    { freq: 659, duration: 0.1, gain: 0.1 },
    { freq: 784, duration: 0.1, gain: 0.1 },
    { freq: 1047, duration: 0.2, gain: 0.08 },
  ],
  lose: [
    { freq: 300, duration: 0.15, gain: 0.1 },
    { freq: 220, duration: 0.2, gain: 0.08 },
    { freq: 165, duration: 0.25, gain: 0.06 },
  ],
};

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx || unlocked) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  unlocked = true;
}

function playSynth(name: SfxName) {
  const ctx = getAudioContext();
  if (!ctx) return;
  let t = ctx.currentTime;
  for (const tone of SYNTH[name]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.value = tone.freq;
    gain.gain.value = tone.gain ?? 0.1;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + tone.duration);
    t += tone.duration * 0.85;
  }
}

export function useGameSfx() {
  const cacheRef = useRef<Partial<Record<SfxName, HTMLAudioElement>>>({});
  const failedRef = useRef<Set<SfxName>>(new Set());

  useEffect(() => {
    const onInteract = () => unlockAudio();
    window.addEventListener('pointerdown', onInteract, { once: true });
    window.addEventListener('keydown', onInteract, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('keydown', onInteract);
    };
  }, []);

  const play = useCallback((name: SfxName) => {
    if (!getSfxEnabled()) return;
    unlockAudio();

    if (!failedRef.current.has(name)) {
      let audio = cacheRef.current[name];
      if (!audio) {
        audio = new Audio(SFX_PATHS[name]);
        audio.preload = 'auto';
        cacheRef.current[name] = audio;
        audio.addEventListener('error', () => {
          failedRef.current.add(name);
        });
      }
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.5;
      void clone.play().catch(() => {
        failedRef.current.add(name);
        playSynth(name);
      });
      return;
    }

    playSynth(name);
  }, []);

  return { play };
}

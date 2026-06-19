import { useCallback, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';

export function useConfetti() {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const burst = useCallback(
    (origin?: { x: number; y: number }) => {
      if (reducedMotion || typeof window === 'undefined') return;

      const canvas = document.createElement('canvas');
      canvas.style.cssText =
        'position:fixed;inset:0;pointer-events:none;z-index:9999;width:100%;height:100%';
      document.body.appendChild(canvas);
      canvasRef.current = canvas;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ox = origin?.x ?? canvas.width / 2;
      const oy = origin?.y ?? canvas.height / 3;
      const colors = ['#fbbf24', '#fef3c7', '#0369a1', '#22c55e', '#f97316'];

      const particles = Array.from({ length: 60 }, () => ({
        x: ox,
        y: oy,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -10 - 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 3,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        life: 1,
      }));

      let frame = 0;
      const maxFrames = 90;

      function tick() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        for (const p of particles) {
          if (p.life <= 0) continue;
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.25;
          p.rotation += p.rotSpeed;
          p.life -= 1 / maxFrames;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        }
        frame++;
        if (alive && frame < maxFrames) {
          requestAnimationFrame(tick);
        } else {
          canvas.remove();
          canvasRef.current = null;
        }
      }

      requestAnimationFrame(tick);
    },
    [reducedMotion]
  );

  return { burst };
}

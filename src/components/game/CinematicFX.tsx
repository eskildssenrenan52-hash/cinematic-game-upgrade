import { useEffect, useRef } from 'react';

type Mote = { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; hue: number; ember: boolean };

/** Atmospheric layer: drifting embers, ash motes and slow volumetric light shafts. */
export function CinematicFX({ playing }: { playing: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      w = c.clientWidth; h = c.clientHeight;
      c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const motes: Mote[] = [];
    const spawn = (anywhere: boolean): Mote => {
      const ember = Math.random() < 0.45;
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + 10,
        vx: (Math.random() - 0.3) * 14,
        vy: -(ember ? 18 + Math.random() * 40 : 4 + Math.random() * 10),
        r: ember ? 0.8 + Math.random() * 1.8 : 0.6 + Math.random() * 1.2,
        life: 0,
        max: 4 + Math.random() * 7,
        hue: ember ? 18 + Math.random() * 25 : 220,
        ember,
      };
    };
    for (let i = 0; i < 70; i++) motes.push(spawn(true));
    let last = performance.now();
    let t = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now; t += dt;
      ctx.clearRect(0, 0, w, h);

      // Volumetric light shafts
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 4; i++) {
        const sway = Math.sin(t * 0.13 + i * 1.7) * w * 0.06;
        const x = w * (0.15 + i * 0.24) + sway;
        const a = 0.035 + 0.025 * Math.sin(t * 0.4 + i * 2.1);
        const g = ctx.createLinearGradient(x, 0, x - w * 0.25, h);
        g.addColorStop(0, `rgba(255,190,130,${a * 1.6})`);
        g.addColorStop(0.6, `rgba(255,140,90,${a * 0.5})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.03, -10);
        ctx.lineTo(x + w * 0.05, -10);
        ctx.lineTo(x - w * 0.18, h);
        ctx.lineTo(x - w * 0.38, h);
        ctx.closePath();
        ctx.fill();
      }

      // Embers and ash
      const target = playingRef.current ? 90 : 130;
      while (motes.length < target) motes.push(spawn(false));
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i];
        m.life += dt;
        m.x += (m.vx + Math.sin(t * 1.3 + m.y * 0.02) * 10) * dt;
        m.y += m.vy * dt;
        const k = m.life / m.max;
        if (k >= 1 || m.y < -20) { motes.splice(i, 1); continue; }
        const fade = Math.sin(Math.PI * k);
        const flick = m.ember ? 0.7 + 0.3 * Math.sin(t * 12 + i) : 1;
        if (m.ember) {
          const rr = m.r * 5;
          const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, rr);
          g.addColorStop(0, `hsla(${m.hue},100%,75%,${0.9 * fade * flick})`);
          g.addColorStop(0.25, `hsla(${m.hue},100%,55%,${0.35 * fade * flick})`);
          g.addColorStop(1, 'hsla(0,0%,0%,0)');
          ctx.fillStyle = g;
          ctx.fillRect(m.x - rr, m.y - rr, rr * 2, rr * 2);
        } else {
          ctx.fillStyle = `rgba(200,195,215,${0.22 * fade})`;
          ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="game-atmos pointer-events-none absolute inset-0 h-full w-full" />;
}

// @ts-nocheck -- imported game code, written for a looser TS config
import type { GameEngine } from './engine';
import { BiomeId, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './types';
import { BIOME_META } from './worldData';

function safeModIdx(n: number, len: number): number {
  return ((Math.floor(n) % len) + len) % len;
}

const skyCache = new Map<BiomeId, HTMLCanvasElement>();
const celestialCache = new Map<string, HTMLCanvasElement>();

function getCachedSky(biome: BiomeId): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const existing = skyCache.get(biome);
  if (existing) return existing;
  const meta = BIOME_META[biome];
  const c = document.createElement('canvas');
  c.width = VIRTUAL_WIDTH;
  c.height = VIRTUAL_HEIGHT;
  const sctx = c.getContext('2d');
  if (!sctx) return null;

  sctx.fillStyle = meta.skyTop;
  sctx.fillRect(0, 0, VIRTUAL_WIDTH, 48);
  sctx.fillStyle = meta.skyMid;
  sctx.fillRect(0, 48, VIRTUAL_WIDTH, 56);
  sctx.fillStyle = meta.skyBottom;
  sctx.fillRect(0, 104, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - 104);

  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  sctx.fillStyle = meta.skyMid;
  for (let y = 32; y < 58; y++) {
    const t = (y - 32) / 26;
    for (let x = 0; x < VIRTUAL_WIDTH; x++) {
      if (bayer[y & 3][x & 3] / 16 < t) sctx.fillRect(x, y, 1, 1);
    }
  }
  sctx.fillStyle = meta.skyBottom;
  for (let y = 86; y < 118; y++) {
    const t = (y - 86) / 32;
    for (let x = 0; x < VIRTUAL_WIDTH; x++) {
      if (bayer[y & 3][x & 3] / 16 < t) sctx.fillRect(x, y, 1, 1);
    }
  }

  // Subtle horizon bloom band baked into static sky
  const hg = sctx.createLinearGradient(0, 88, 0, VIRTUAL_HEIGHT);
  hg.addColorStop(0, 'rgba(0,0,0,0)');
  hg.addColorStop(0.65, meta.accent + '20');
  hg.addColorStop(1, meta.secondaryAccent + '14');
  sctx.fillStyle = hg;
  sctx.fillRect(0, 88, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - 88);

  skyCache.set(biome, c);
  return c;
}

function getCachedCelestialDisc(key: string, accent: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const existing = celestialCache.get(key);
  if (existing) return existing;

  const c = document.createElement('canvas');
  if (key.startsWith('crescent:')) {
    const r = 13;
    c.width = 28;
    c.height = 28;
    const dctx = c.getContext('2d');
    if (!dctx) return null;
    const cx = 14;
    const cy = 14;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 <= r * r) {
          const cut = (dx - 5) * (dx - 5) + (dy + 2) * (dy + 2);
          if (cut > (r - 2) * (r - 2)) {
            const crater = (dx + 5) * (dx + 5) + (dy - 2) * (dy - 2) <= 3 || (dx + 2) * (dx + 2) + (dy + 5) * (dy + 5) <= 2;
            dctx.fillStyle = crater
              ? accent
              : d2 > (r - 2) * (r - 2)
                ? accent
                : '#fff9ea';
            dctx.fillRect(cx + dx, cy + dy, 1, 1);
          }
        }
      }
    }
  } else if (key === 'astral_planet') {
    c.width = 26;
    c.height = 26;
    const dctx = c.getContext('2d');
    if (!dctx) return null;
    const cx = 13;
    const cy = 13;
    for (let dy = -12; dy <= 12; dy++) {
      for (let dx = -12; dx <= 12; dx++) {
        if (dx * dx + dy * dy <= 144) {
          const band = Math.abs(dy + Math.round(dx * 0.15)) % 5 === 0;
          dctx.fillStyle = dy < -4 ? (band ? '#a774ff' : '#864ae8') : dy < 4 ? (band ? '#6838c2' : '#53299e') : '#291157';
          dctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }
  } else if (key === 'sakura_moon') {
    c.width = 32;
    c.height = 32;
    const dctx = c.getContext('2d');
    if (!dctx) return null;
    const cx = 16;
    const cy = 16;
    for (let dy = -15; dy <= 15; dy++) {
      for (let dx = -15; dx <= 15; dx++) {
        if (dx * dx + dy * dy <= 225) {
          const mare = (dx + 3) * (dx + 3) + (dy + 2) * (dy + 2) < 22 || (dx - 5) * (dx - 5) + (dy - 4) * (dy - 4) < 14;
          dctx.fillStyle = dy < -4 ? (mare ? '#ffd1e3' : '#fff0f6') : dy < 6 ? (mare ? '#ff8fbd' : '#ffb3d1') : '#d9487f';
          dctx.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }
  } else if (key === 'amethyst_moon') {
    c.width = 28;
    c.height = 28;
    const dctx = c.getContext('2d');
    if (!dctx) return null;
    const cx = 14;
    const cy = 14;
    for (let dy = -12; dy <= 12; dy++) {
      for (let dx = -12; dx <= 12; dx++) {
        if (dx * dx + dy * dy <= 144) {
          const cut = (dx - 4) * (dx - 4) + (dy + 2) * (dy + 2);
          if (cut > 95) {
            dctx.fillStyle = dy < 0 ? '#f3e8ff' : '#c084fc';
            dctx.fillRect(cx + dx, cy + dy, 1, 1);
          }
        }
      }
    }
  }
  celestialCache.set(key, c);
  return c;
}

export function drawEnhancedBackdrop(
  ctx: CanvasRenderingContext2D,
  biome: BiomeId,
  gx: number,
  gy: number,
  camX: number,
  camY: number,
  time: number,
  engine: GameEngine
): void {
  const meta = BIOME_META[biome];
  const pSky = Math.round(camX * 0.04);
  const pSkyY = Math.round(camY * 0.03);
  const pCloud = Math.round(camX * 0.10);
  const pFar = Math.round(camX * 0.18);
  const pFarY = Math.round(camY * 0.07);
  const pMid = Math.round(camX * 0.34);
  const pMidY = Math.round(camY * 0.14);
  const pNear = Math.round(camX * 0.58);
  const pNearY = Math.round(camY * 0.22);

  // Plane 0: Cached 3-Stop Pixel Sky + 4x4 Ordered Bayer Dithering
  const cachedSky = getCachedSky(biome);
  if (cachedSky) {
    ctx.drawImage(cachedSky, 0, 0);
  } else {
    ctx.fillStyle = meta.skyTop;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, 48);
    ctx.fillStyle = meta.skyMid;
    ctx.fillRect(0, 48, VIRTUAL_WIDTH, 56);
    ctx.fillStyle = meta.skyBottom;
    ctx.fillRect(0, 104, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - 104);
  }

  // Distant branching sky lightning & sheet illumination on Stormcrown
  if (biome === 'stormcrown') {
    const wave = Math.sin(time * 1.9);
    const wave2 = Math.sin(time * 3.1 + 1.4);
    if (wave > 0.92 || wave2 > 0.96) {
      ctx.fillStyle = '#d8f4ff26';
      ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      const lx = safeModIdx(190 - pSky + (wave2 > 0.96 ? 80 : 0), VIRTUAL_WIDTH);
      ctx.fillStyle = '#fff9c4ee';
      ctx.fillRect(lx, 6, 2, 26);
      ctx.fillRect(lx - 4, 32, 5, 2);
      ctx.fillRect(lx - 6, 34, 2, 24);
      ctx.fillRect(lx + 1, 22, 6, 1);
      ctx.fillRect(lx + 6, 23, 2, 16);
      ctx.fillStyle = '#7ce8ff88';
      ctx.fillRect(lx - 1, 10, 4, 18);
    }
  }

  // Layered Starfield + Subtle Constellation Lines (0.04x parallax + twinkle)
  for (let i = 0; i < 68; i++) {
    const sx = safeModIdx(i * 53 + gx * 19 + (i % 3) * 7 - pSky * (i % 2 === 0 ? 1 : 0.6), VIRTUAL_WIDTH);
    const sy = safeModIdx(i * 29 + gy * 11 - pSkyY, 114);
    const twinkle = Math.sin(time * 2.8 + i * 1.4);
    if (twinkle > 0.68) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy, 2, 2);
      ctx.fillStyle = meta.secondaryAccent + '88';
      ctx.fillRect(sx - 1, sy, 1, 1);
      ctx.fillRect(sx + 2, sy, 1, 1);
      ctx.fillRect(sx, sy - 1, 1, 1);
      ctx.fillRect(sx, sy + 2, 1, 1);
    } else {
      ctx.fillStyle = twinkle > -0.1 ? '#ffffffcc' : meta.tileHighlight + '77';
      ctx.fillRect(sx, sy, 1, 1);
    }
  }

  // Occasional Shooting Star with glowing multi-tone tail
  const meteorCycle = time % 5.4;
  if (meteorCycle < 0.7) {
    const p = meteorCycle / 0.7;
    const mx = Math.round(32 + p * 205 - pSky * 0.5);
    const my = Math.round(10 + p * 52);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx, my, 2, 2);
    ctx.fillStyle = meta.secondaryAccent + 'dd';
    ctx.fillRect(mx - 4, my - 1, 4, 1);
    ctx.fillStyle = meta.accent + '88';
    ctx.fillRect(mx - 9, my - 2, 5, 1);
    ctx.fillRect(mx - 13, my - 3, 4, 1);
  }

  // Biome Celestial / Cavern Spectacle
  if (biome === 'silver_ash' || biome === 'stormcrown') {
    const mx = 214 - gx * 4 - Math.round(pSky * 0.5);
    const my = 34 - Math.round(pSkyY * 0.4);
    const mg = ctx.createRadialGradient(mx, my, 3, mx, my, 32);
    mg.addColorStop(0, meta.accent + '55');
    mg.addColorStop(0.55, meta.secondaryAccent + '1c');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 32, my - 32, 64, 64);

    const disc = getCachedCelestialDisc(`crescent:${meta.accent}`, meta.accent);
    if (disc) {
      ctx.drawImage(disc, mx - 14, my - 14);
    }
    const cd = Math.round(time * 4) % 52;
    ctx.fillStyle = meta.skyMid + 'cc';
    ctx.fillRect(mx - 22 + cd, my + 2, 18, 3);
    ctx.fillRect(mx - 15 + cd, my + 1, 11, 2);
  } else if (biome === 'astral_void') {
    const px = 250 - gx * 4 - Math.round(pSky * 0.5);
    const py = 36 - Math.round(pSkyY * 0.4);
    const pg = ctx.createRadialGradient(px, py, 4, px, py, 36);
    pg.addColorStop(0, '#d580ff55');
    pg.addColorStop(0.5, '#66eeff22');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(px - 36, py - 36, 72, 72);

    // Sweeping nebula curtains
    for (let nx = -68; nx < -12; nx += 4) {
      const nOff = Math.round(Math.sin(time * 0.8 + nx * 0.08) * 6);
      ctx.fillStyle = nx % 8 === 0 ? '#66eeff1a' : '#8b5cf624';
      ctx.fillRect(px + nx, 4 + nOff, 4, 86);
    }

    const disc = getCachedCelestialDisc('astral_planet', meta.accent);
    if (disc) ctx.drawImage(disc, px - 13, py - 13);

    // Tilted sparkling planetary rings
    ctx.strokeStyle = '#e6b3ffbb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(px, py, 22, 5, -0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#66eeff99';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(px, py, 26, 6.5, -0.22, 0, Math.PI * 2);
    ctx.stroke();

    const omx = Math.round(px + Math.cos(time * 1.1) * 24);
    const omy = Math.round(py + Math.sin(time * 1.1) * 8);
    ctx.fillStyle = '#66eeff';
    ctx.fillRect(omx - 1, omy - 1, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(omx, omy, 1, 1);
  } else if (biome === 'frostglass') {
    for (let x = 0; x < VIRTUAL_WIDTH; x += 2) {
      const ax = x + pSky;
      const ay = 16 + Math.round(Math.sin(ax * 0.028 + time * 1.35) * 10);
      const h = 24 + Math.round(Math.cos(ax * 0.045 - time * 0.9) * 8);
      ctx.fillStyle = '#5ef2ff3f';
      ctx.fillRect(x, ay, 2, h);
      ctx.fillStyle = '#b8ffea3c';
      ctx.fillRect(x, ay + 4, 2, 11);
      ctx.fillStyle = '#a880ff2c';
      ctx.fillRect(x, ay - 3, 2, 6);
      if (x % 6 === 0) {
        ctx.fillStyle = '#ffffff30';
        ctx.fillRect(x, ay + 2, 1, h - 4);
      }
    }
  } else if (biome === 'obsidian_forge') {
    // Twin distant lava falls + smoke plumes + hanging chains
    for (let f = 0; f < 2; f++) {
      const fx = safeModIdx(116 + f * 124 - gx * 6 - pFar, VIRTUAL_WIDTH + 24) - 12;
      const fw = f === 0 ? 14 : 9;
      ctx.fillStyle = '#ff44113d';
      ctx.fillRect(fx - 2, 42, fw + 4, VIRTUAL_HEIGHT - 42);
      ctx.fillStyle = '#ff882255';
      ctx.fillRect(fx, 44, fw, VIRTUAL_HEIGHT - 44);
      const flow = Math.floor(time * 28 + f * 7) % 14;
      ctx.fillStyle = '#ffe06677';
      for (let y = 44 + flow; y < VIRTUAL_HEIGHT; y += 14) {
        ctx.fillRect(fx + 1, y, fw - 2, 6);
      }
    }
    ctx.fillStyle = '#290b0b';
    for (let i = 0; i < 6; i++) {
      const cx = safeModIdx(i * 58 - pFar, VIRTUAL_WIDTH);
      const sway = Math.round(Math.sin(time * 1.5 + i) * 1.4);
      for (let cy = 0; cy < 66 + ((i * 19) % 28); cy += 4) {
        ctx.fillRect(cx + sway, cy, 2, 3);
        if (cy % 12 === 0) {
          ctx.fillStyle = '#ff662244';
          ctx.fillRect(cx + sway, cy + 1, 2, 1);
          ctx.fillStyle = '#290b0b';
        }
      }
    }
  } else if (biome === 'bioluminescent') {
    ctx.fillStyle = '#061a24';
    for (let i = 0; i < 12; i++) {
      const sx = safeModIdx(i * 34 - pFar, VIRTUAL_WIDTH + 16) - 8;
      const sh = 16 + ((i * 13 + gx * 5) % 20);
      ctx.fillRect(sx, 0, 8, sh);
      ctx.fillRect(sx + 2, sh, 4, 7);
      if (i % 2 === 0) {
        const glow = Math.sin(time * 2.5 + i) > 0 ? '#7dffe288' : '#4df0c055';
        ctx.fillStyle = glow;
        ctx.fillRect(sx + 3, sh + 7, 2, 11);
        ctx.fillRect(sx + 2, sh + 16, 4, 2);
        ctx.fillStyle = '#061a24';
      }
    }
  } else if (biome === 'crimson_sakura') {
    const mx = 224 - gx * 4 - Math.round(pSky * 0.45);
    const my = 40 - Math.round(pSkyY * 0.4);
    const mg = ctx.createRadialGradient(mx, my, 4, mx, my, 38);
    mg.addColorStop(0, '#ff70a666');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 38, my - 38, 76, 76);
    const disc = getCachedCelestialDisc('sakura_moon', meta.accent);
    if (disc) ctx.drawImage(disc, mx - 16, my - 16);

    // Curved Pagoda Tiers + Glowing Warm Windows
    ctx.fillStyle = meta.mountainFar;
    for (let i = 0; i < 3; i++) {
      const px = safeModIdx(48 + i * 110 - pFar, VIRTUAL_WIDTH + 40) - 20;
      ctx.fillRect(px - 10, 82, 20, 44);
      ctx.fillRect(px - 16, 79, 32, 4);
      ctx.fillRect(px - 18, 77, 4, 2);
      ctx.fillRect(px + 14, 77, 4, 2);
      ctx.fillRect(px - 12, 66, 24, 4);
      ctx.fillRect(px - 7, 56, 14, 4);
      ctx.fillRect(px - 1, 49, 2, 7);
      ctx.fillStyle = '#ffd27d77';
      ctx.fillRect(px - 2, 88, 4, 6);
      ctx.fillRect(px - 2, 70, 4, 4);
      ctx.fillStyle = meta.mountainFar;
    }
  } else if (biome === 'sunken_cathedral') {
    for (let i = 0; i < 6; i++) {
      const rx = safeModIdx(24 + i * 62 - pSky + Math.round(Math.sin(time * 1.4 + i) * 6), VIRTUAL_WIDTH);
      const rg = ctx.createLinearGradient(rx, 0, rx + 8, 145);
      rg.addColorStop(0, '#a8f9ff2c');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 10 + (i % 3) * 4, 0);
      ctx.lineTo(rx + 28 + (i % 3) * 4, 150);
      ctx.lineTo(rx + 8, 150);
      ctx.closePath();
      ctx.fill();
    }
    // Distant silhouetted gliding manta rays & bubbles
    for (let m = 0; m < 2; m++) {
      const mx = safeModIdx(Math.round(time * (18 + m * 6) + m * 170 - pFar), VIRTUAL_WIDTH + 40) - 20;
      const my = 48 + m * 28 + Math.round(Math.sin(time * 2 + m) * 4);
      const flap = Math.round(Math.sin(time * 4 + m) * 2);
      ctx.fillStyle = '#072236aa';
      ctx.fillRect(mx - 6, my, 12, 3);
      ctx.fillRect(mx - 10, my + flap, 5, 2);
      ctx.fillRect(mx + 5, my + flap, 5, 2);
      ctx.fillRect(mx - 9, my + 1, 4, 1);
    }
    for (let i = 0; i < 14; i++) {
      const bx = safeModIdx(i * 27 - pFar, VIRTUAL_WIDTH);
      const by = safeModIdx(VIRTUAL_HEIGHT - Math.round(time * (16 + (i % 4) * 5) + i * 21), 130);
      ctx.fillStyle = '#a8f9ff66';
      ctx.fillRect(bx, by, 2, 2);
      ctx.fillStyle = '#ffffffaa';
      ctx.fillRect(bx, by, 1, 1);
    }
  } else if (biome === 'clockwork_spire') {
    for (let g = 0; g < 4; g++) {
      const gcx = safeModIdx(56 + g * 88 - pFar, VIRTUAL_WIDTH + 60) - 30;
      const gcy = 48 + (g % 2) * 26 - Math.round(pFarY * 0.4);
      const rad = 18 + (g % 3) * 6;
      ctx.strokeStyle = '#ffb84d34';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(gcx, gcy, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      const dir = g % 2 === 0 ? 1 : -1;
      for (let t = 0; t < 12; t++) {
        const a = time * 0.45 * dir + (t * Math.PI * 2) / 12;
        const tx = Math.round(gcx + Math.cos(a) * (rad + 4));
        const ty = Math.round(gcy + Math.sin(a) * (rad + 4));
        ctx.fillStyle = '#ffb84d3a';
        ctx.fillRect(tx - 2, ty - 2, 4, 4);
      }
      ctx.fillStyle = '#66e6ff33';
      ctx.fillRect(gcx - 2, gcy - 2, 4, 4);
    }
  } else if (biome === 'emerald_sky') {
    const sx = 246 - gx * 4 - Math.round(pSky * 0.4);
    const sy = 32 - Math.round(pSkyY * 0.35);
    const sg = ctx.createRadialGradient(sx, sy, 3, sx, sy, 42);
    sg.addColorStop(0, '#ffe98577');
    sg.addColorStop(0.5, '#57f2a82e');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 42, sy - 42, 84, 84);
    ctx.fillStyle = '#fff5b8';
    ctx.fillRect(sx - 6, sy - 6, 12, 12);

    for (let i = 0; i < 4; i++) {
      const ix = safeModIdx(38 + i * 84 - pFar, VIRTUAL_WIDTH + 40) - 20;
      const iy = 48 + (i % 2) * 18 + Math.round(Math.sin(time * 1.4 + i) * 2);
      ctx.fillStyle = meta.mountainMid;
      ctx.fillRect(ix, iy, 28, 7);
      ctx.fillRect(ix + 5, iy + 7, 18, 6);
      ctx.fillRect(ix + 10, iy + 13, 8, 5);
      ctx.fillStyle = '#57f2a877';
      ctx.fillRect(ix + 1, iy - 2, 26, 3);
      ctx.fillStyle = '#a8f9ff55';
      const flow = Math.floor(time * 24) % 8;
      ctx.fillRect(ix + 21, iy + 1, 3, 28);
      ctx.fillStyle = '#ffffff66';
      ctx.fillRect(ix + 22, iy + 2 + flow, 1, 5);
    }
  } else if (biome === 'solar_mirage') {
    const sx = 236 - gx * 4 - Math.round(pSky * 0.4);
    const sy = 34 - Math.round(pSkyY * 0.35);
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 44);
    sg.addColorStop(0, '#ffe47a88');
    sg.addColorStop(0.55, '#ff8f3338');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 44, sy - 44, 88, 88);
    ctx.fillStyle = '#fff5b8';
    ctx.fillRect(sx - 9, sy - 9, 18, 18);
    ctx.fillStyle = '#ffb84d';
    ctx.fillRect(sx + 16, sy + 4, 7, 7);
    ctx.fillStyle = meta.mountainFar;
    for (let i = 0; i < 3; i++) {
      const px = safeModIdx(40 + i * 108 - pFar, VIRTUAL_WIDTH + 60) - 30;
      for (let tier = 0; tier < 18; tier++) {
        ctx.fillRect(px + tier, 118 - tier * 2, 38 - tier * 2, 2);
      }
      ctx.fillStyle = '#ffd24d55';
      ctx.fillRect(px + 18, 82, 2, 4);
      ctx.fillStyle = meta.mountainFar;
    }
  } else if (biome === 'amethyst_crypt') {
    const mx = 228 - gx * 4 - Math.round(pSky * 0.45);
    const my = 36 - Math.round(pSkyY * 0.35);
    const mg = ctx.createRadialGradient(mx, my, 4, mx, my, 38);
    mg.addColorStop(0, '#c084fc66');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 38, my - 38, 76, 76);
    const disc = getCachedCelestialDisc('amethyst_moon', meta.accent);
    if (disc) ctx.drawImage(disc, mx - 14, my - 14);
    for (let i = 0; i < 4; i++) {
      const rx = safeModIdx(36 + i * 86 - pFar, VIRTUAL_WIDTH + 30) - 15;
      const ry = 44 + (i % 2) * 18 + Math.round(Math.sin(time * 1.8 + i) * 3);
      ctx.fillStyle = '#1b0e2e';
      ctx.fillRect(rx, ry, 10, 22);
      ctx.fillStyle = '#c084fcaa';
      ctx.fillRect(rx + 4, ry + 5, 2, 4);
      ctx.fillRect(rx + 3, ry + 12, 4, 2);
    }
  } else if (biome === 'alchemical_labs') {
    for (let i = 0; i < 4; i++) {
      const vx = safeModIdx(42 + i * 88 - pFar, VIRTUAL_WIDTH + 40) - 20;
      ctx.fillStyle = '#0c1c26';
      ctx.fillRect(vx, 30, 18, 82);
      ctx.fillStyle = i % 2 === 0 ? '#34d3993c' : '#f472b63c';
      ctx.fillRect(vx + 2, 36, 14, 72);
      const bub = Math.floor(time * 18 + i * 17) % 60;
      ctx.fillStyle = i % 2 === 0 ? '#6ee7b7bb' : '#fbcfe8bb';
      ctx.fillRect(vx + 6 + (i % 3), 104 - bub, 3, 3);
      ctx.fillStyle = '#ffffff44';
      ctx.fillRect(vx + 3, 40, 2, 60);
    }
  } else if (biome === 'aurora_zenith') {
    for (let x = 0; x < VIRTUAL_WIDTH; x += 2) {
      const ax = x + pSky;
      const ay = 14 + Math.round(Math.sin(ax * 0.025 + time * 1.5) * 9);
      const h = 26 + Math.round(Math.cos(ax * 0.04 - time * 1.1) * 9);
      ctx.fillStyle = '#38bdf844';
      ctx.fillRect(x, ay, 2, h);
      ctx.fillStyle = '#34d39938';
      ctx.fillRect(x, ay + 5, 2, 12);
      ctx.fillStyle = '#f472b62c';
      ctx.fillRect(x, ay - 3, 2, 7);
      ctx.fillStyle = '#fde04722';
      ctx.fillRect(x, ay + h - 4, 2, 4);
    }
  } else if (biome === 'crimson_canyon') {
    const sx = 230 - gx * 4 - Math.round(pSky * 0.45);
    const sy = 36 - Math.round(pSkyY * 0.35);
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 44);
    sg.addColorStop(0, '#ff773380');
    sg.addColorStop(0.55, '#fb718538');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 44, sy - 44, 88, 88);
    ctx.fillStyle = '#fff5c4';
    ctx.fillRect(sx - 10, sy - 10, 20, 20);
    ctx.fillStyle = '#ff9944';
    ctx.fillRect(sx - 12, sy - 4, 24, 8);
    ctx.fillStyle = meta.mountainFar;
    for (let i = 0; i < 4; i++) {
      const mx = safeModIdx(24 + i * 86 - pFar, VIRTUAL_WIDTH + 50) - 25;
      const mh = 34 + (i % 2) * 14;
      ctx.fillRect(mx, VIRTUAL_HEIGHT - mh - 46, 36, mh + 46);
      ctx.fillRect(mx - 6, VIRTUAL_HEIGHT - mh - 32, 48, 32);
      ctx.fillStyle = '#fb923c44';
      ctx.fillRect(mx, VIRTUAL_HEIGHT - mh - 46, 36, 2);
      ctx.fillStyle = meta.mountainFar;
    }
  } else if (biome === 'cyber_undercity') {
    for (let i = 0; i < 5; i++) {
      const tx = safeModIdx(18 + i * 70 - pFar, VIRTUAL_WIDTH + 40) - 20;
      const th = 58 + ((i * 23) % 34);
      ctx.fillStyle = '#070a1c';
      ctx.fillRect(tx, VIRTUAL_HEIGHT - th - 36, 22, th + 36);
      const neonCol = i % 2 === 0 ? '#22d3ee99' : '#f472b699';
      ctx.fillStyle = neonCol;
      ctx.fillRect(tx + 2, VIRTUAL_HEIGHT - th - 34, 18, 2);
      for (let wy = VIRTUAL_HEIGHT - th - 26; wy < VIRTUAL_HEIGHT - 44; wy += 6) {
        if ((wy + i * 3) % 12 === 0) {
          ctx.fillRect(tx + 4, wy, 5, 2);
          ctx.fillRect(tx + 13, wy, 5, 2);
        }
      }
      if (i % 2 === 1) {
        const flick = Math.floor(time * 6 + i) % 5 !== 0;
        if (flick) {
          ctx.fillStyle = '#22d3ee38';
          ctx.fillRect(tx - 4, VIRTUAL_HEIGHT - th - 48, 30, 8);
          ctx.fillStyle = '#ffffffbb';
          ctx.fillRect(tx, VIRTUAL_HEIGHT - th - 45, 20, 2);
        }
      }
    }
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 58, VIRTUAL_WIDTH, 3);
    const trainX = safeModIdx(Math.round(time * 75 - pFar), VIRTUAL_WIDTH + 60) - 40;
    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(trainX, 54, 24, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(trainX + 2, 55, 16, 1);
    ctx.fillStyle = '#f472b6';
    ctx.fillRect(trainX + 20, 55, 4, 2);
  } else if (biome === 'celestial_marble') {
    const sx = 160 - Math.round(pSky * 0.3);
    const sg = ctx.createRadialGradient(sx, 36, 5, sx, 36, 54);
    sg.addColorStop(0, '#fff7cc88');
    sg.addColorStop(0.6, '#fbbf242e');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 54, 0, 108, 92);
    ctx.fillStyle = '#e2e8f028';
    ctx.fillRect(sx - 34, 46, 68, 42);
    ctx.fillStyle = '#fbbf2455';
    ctx.fillRect(sx - 20, 32, 40, 14);
    ctx.fillRect(sx - 2, 24, 4, 8);
    for (let c = -28; c <= 28; c += 14) {
      ctx.fillStyle = '#f8fafc44';
      ctx.fillRect(sx + c - 2, 48, 4, 38);
    }
  } else if (biome === 'ebony_fen') {
    const mx = 216 - gx * 4 - Math.round(pSky * 0.45);
    const my = 34 - Math.round(pSkyY * 0.35);
    const mg = ctx.createRadialGradient(mx, my, 4, mx, my, 38);
    mg.addColorStop(0, '#4df0c044');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 38, my - 38, 76, 76);
    ctx.fillStyle = '#bbf7d0';
    ctx.fillRect(mx - 10, my - 10, 20, 20);
    ctx.fillStyle = meta.skyMid;
    ctx.fillRect(mx - 4, my - 6, 6, 5);
    for (let i = 0; i < 6; i++) {
      const fx = safeModIdx(i * 58 - pFar, VIRTUAL_WIDTH);
      const fy = 92 + Math.round(Math.sin(time * 2 + i) * 6);
      ctx.fillStyle = '#34d399aa';
      ctx.fillRect(fx, fy, 2, 2);
      ctx.fillStyle = '#ffffffbb';
      ctx.fillRect(fx, fy, 1, 1);
    }
  } else if (biome === 'orbital_nexus') {
    ctx.fillStyle = '#081b38';
    ctx.fillRect(0, 118, VIRTUAL_WIDTH, 62);
    ctx.fillStyle = '#38bdf855';
    ctx.fillRect(0, 117, VIRTUAL_WIDTH, 2);
    ctx.fillStyle = '#ffffffaa';
    ctx.fillRect(0, 118, VIRTUAL_WIDTH, 1);
    const ox = 196 - Math.round(pSky * 0.4);
    const oy = 42 - Math.round(pSkyY * 0.3);
    ctx.strokeStyle = '#67e8f977';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(ox, oy, 38, 12, -0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(ox - 5, oy - 5, 10, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox - 2, oy - 2, 4, 4);
  } else if (biome === 'twilight_garden') {
    const mx = 224 - gx * 4 - Math.round(pSky * 0.45);
    const my = 38 - Math.round(pSkyY * 0.35);
    const mg = ctx.createRadialGradient(mx, my, 4, mx, my, 44);
    mg.addColorStop(0, '#c084fc66');
    mg.addColorStop(0.6, '#f472b626');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 44, my - 44, 88, 88);
    const disc = getCachedCelestialDisc('crescent:#e879f9', '#e879f9');
    if (disc) ctx.drawImage(disc, mx - 14, my - 14);
    for (let i = 0; i < 8; i++) {
      const vx = safeModIdx(i * 44 - pFar, VIRTUAL_WIDTH);
      const sway = Math.round(Math.sin(time * 2 + i) * 1.2);
      const vh = 18 + ((i * 11) % 22);
      ctx.fillStyle = '#4c1d95';
      ctx.fillRect(vx + sway, 0, 2, vh);
      ctx.fillStyle = i % 2 === 0 ? '#f472b6cc' : '#67e8f9cc';
      ctx.fillRect(vx - 1 + sway, vh, 4, 4);
    }
  }

  // Subtle animated aurora / atmospheric shimmer across upper sky
  for (let ax = 0; ax < VIRTUAL_WIDTH; ax += 6) {
    const waveY = 12 + Math.round(Math.sin(time * 0.85 + ax * 0.04) * 5);
    const alpha = 0.08 + 0.06 * Math.sin(time * 1.3 + ax * 0.07);
    ctx.fillStyle = meta.accent + Math.round(alpha * 255).toString(16).padStart(2, '0');
    ctx.fillRect(ax, waveY, 6, 8);
  }

  // Horizon atmospheric glow wash
  const horizonGrad = ctx.createLinearGradient(0, 62, 0, VIRTUAL_HEIGHT - 22);
  horizonGrad.addColorStop(0, 'rgba(0,0,0,0)');
  horizonGrad.addColorStop(0.55, meta.accent + '26');
  horizonGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = horizonGrad;
  ctx.fillRect(0, 62, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - 84);

  // Plane 1: 3-Tone Cel-Shaded Drifting Clouds with Rim Highlights
  if (biome !== 'obsidian_forge' && biome !== 'sunken_cathedral') {
    const cloudSpan = VIRTUAL_WIDTH + 92;
    for (let i = 0; i < 7; i++) {
      const cw = 32 + (i % 3) * 14;
      const cx =
        safeModIdx(i * 64 + time * (3.2 + (i % 3) * 0.75) - gx * 12 - pCloud, cloudSpan) - 54;
      const cy = 15 + (i % 3) * 17 - Math.round(pSkyY * 0.5);
      ctx.fillStyle = meta.mountainFar + 'aa';
      ctx.fillRect(cx + 2, cy + 5, cw - 4, 3);
      ctx.fillStyle = meta.tileHighlight + '3c';
      ctx.fillRect(cx, cy + 2, cw, 4);
      ctx.fillRect(cx + 5, cy - 2, cw - 12, 4);
      ctx.fillRect(cx + 10, cy - 4, Math.max(8, cw - 22), 2);
      ctx.fillStyle = meta.secondaryAccent + '42';
      ctx.fillRect(cx + 11, cy - 4, Math.max(6, cw - 24), 1);
    }
  }

  // Plane 2: Far Ruins / Cathedral Arches / Lit Citadels / Giant Mushrooms (0.18x parallax)
  ctx.fillStyle = meta.mountainFar;
  const ruinPeriod = 54;
  for (let i = -1; i <= Math.ceil(VIRTUAL_WIDTH / ruinPeriod) + 1; i++) {
    const worldSlot = Math.floor(pFar / ruinPeriod) + i;
    const px = worldSlot * ruinPeriod - pFar;
    const hash = Math.abs(worldSlot * 17 + gx * 23);
    const ph = 62 + (hash % 38);
    const baseY = VIRTUAL_HEIGHT - ph + Math.round(pFarY * 0.4);
    if (biome === 'bioluminescent') {
      ctx.fillRect(px + 2, baseY, 4, ph);
      ctx.fillRect(px - 10, baseY - 5, 28, 7);
      const glowOn = Math.sin(time * 2.2 + worldSlot) > -0.2;
      ctx.fillStyle = glowOn ? '#4df0c077' : '#34d39933';
      ctx.fillRect(px - 6, baseY - 3, 6, 2);
      ctx.fillRect(px + 6, baseY - 4, 5, 2);
      ctx.fillStyle = '#a7f3d066';
      ctx.fillRect(px - 3, baseY + 2, 2, 5);
      ctx.fillStyle = meta.mountainFar;
    } else {
      ctx.fillRect(px, baseY, 14, ph);
      ctx.fillRect(px - 2, baseY, 18, 4);
      ctx.fillRect(px + 3, baseY - 5, 8, 5);
      ctx.fillRect(px + 5, baseY - 11, 3, 6);
      // Animated banner on tower spire
      const flagSway = Math.round(Math.sin(time * 4.2 + worldSlot * 1.4) * 1.5);
      ctx.fillStyle = meta.accent + '66';
      ctx.fillRect(px + 8, baseY - 10 + (flagSway > 0 ? 1 : 0), 5, 2);
      // Lit sanctuary windows
      const lit = Math.sin(time * 1.8 + hash) > -0.5;
      ctx.fillStyle = lit ? meta.secondaryAccent + '55' : meta.accent + '2a';
      ctx.fillRect(px + 4, baseY + 9, 5, 9);
      ctx.fillRect(px + 5, baseY + 24, 3, 5);
      ctx.fillStyle = meta.mountainFar;
      if (Math.abs(worldSlot) % 2 === 0) {
        ctx.fillRect(px + 14, baseY + 9, ruinPeriod - 14, 4);
        ctx.fillStyle = meta.accent + '22';
        ctx.fillRect(px + 14, baseY + 9, ruinPeriod - 14, 1);
        ctx.fillStyle = meta.mountainFar;
      }
    }
  }

  // Plane 2.5: Far Mountain Ridge + Illuminated Crests + Depth Haze
  for (let x = 0; x < VIRTUAL_WIDTH; x += 2) {
    const wx = x + pFar + gx * 40;
    const h =
      68 +
      Math.round(Math.sin(wx * 0.022) * 18 + Math.cos(wx * 0.052) * 9) -
      Math.round(pFarY * 0.5);
    const fh = Math.max(24, h);
    ctx.fillStyle = meta.mountainFar;
    ctx.fillRect(x, VIRTUAL_HEIGHT - fh, 2, fh);
    ctx.fillStyle = meta.tileHighlight + '28';
    ctx.fillRect(x, VIRTUAL_HEIGHT - fh, 2, 2);
  }
  ctx.fillStyle = meta.skyBottom + '46';
  ctx.fillRect(0, VIRTUAL_HEIGHT - 72, VIRTUAL_WIDTH, 22);

  // Plane 3: Mid Silhouette Ridge + Rim-lit Slopes + Biome Landmarks (0.34x parallax)
  for (let x = 0; x < VIRTUAL_WIDTH; x += 2) {
    const wx = x + pMid + gx * 55;
    const h =
      48 +
      Math.round(Math.sin(wx * 0.031 + 0.8) * 14 + Math.cos((wx + gy * 25) * 0.068) * 7) -
      Math.round(pMidY * 0.6);
    const mh = Math.max(18, h);
    ctx.fillStyle = meta.mountainMid;
    ctx.fillRect(x, VIRTUAL_HEIGHT - mh, 2, mh);
    ctx.fillStyle = meta.accent + '2c';
    ctx.fillRect(x, VIRTUAL_HEIGHT - mh, 2, 1);
    ctx.fillStyle = meta.mountainMid;
    if (wx % 16 === 0) {
      if (biome === 'silver_ash' || biome === 'frostglass' || biome === 'emerald_sky') {
        ctx.fillRect(x, VIRTUAL_HEIGHT - mh - 8, 2, 8);
        ctx.fillRect(x - 2, VIRTUAL_HEIGHT - mh - 4, 6, 2);
      } else if (biome === 'crimson_sakura') {
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 6, 4, 6);
        ctx.fillStyle = '#ff70a655';
        ctx.fillRect(x - 4, VIRTUAL_HEIGHT - mh - 10, 10, 4);
      } else if (biome === 'sunken_cathedral') {
        ctx.fillRect(x, VIRTUAL_HEIGHT - mh - 9, 2, 9);
        ctx.fillRect(x + 2, VIRTUAL_HEIGHT - mh - 6, 2, 3);
      } else if (biome === 'clockwork_spire') {
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 10, 4, 10);
        ctx.fillStyle = '#ffb84d66';
        ctx.fillRect(x, VIRTUAL_HEIGHT - mh - 12, 2, 2);
      } else if (biome === 'astral_void') {
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 11, 4, 11);
        ctx.fillStyle = '#d580ff66';
        ctx.fillRect(x, VIRTUAL_HEIGHT - mh - 9, 2, 2);
      } else if (biome === 'solar_mirage') {
        ctx.fillRect(x - 2, VIRTUAL_HEIGHT - mh - 6, 6, 6);
        ctx.fillRect(x, VIRTUAL_HEIGHT - mh - 11, 2, 5);
      } else if (biome === 'amethyst_crypt') {
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 11, 4, 11);
        ctx.fillStyle = '#c084fc66';
        ctx.fillRect(x, VIRTUAL_HEIGHT - mh - 9, 2, 3);
      } else if (biome === 'alchemical_labs') {
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 9, 4, 9);
        ctx.fillStyle = '#34d39966';
        ctx.fillRect(x, VIRTUAL_HEIGHT - mh - 11, 2, 2);
      } else if (biome === 'aurora_zenith') {
        ctx.fillRect(x, VIRTUAL_HEIGHT - mh - 12, 2, 12);
        ctx.fillStyle = '#38bdf877';
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 8, 4, 2);
      } else if (biome === 'crimson_canyon') {
        ctx.fillRect(x - 2, VIRTUAL_HEIGHT - mh - 7, 6, 7);
        ctx.fillStyle = '#fb923c66';
        ctx.fillRect(x - 2, VIRTUAL_HEIGHT - mh - 7, 6, 2);
      } else if (biome === 'cyber_undercity') {
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 13, 4, 13);
        ctx.fillStyle = '#22d3ee99';
        ctx.fillRect(x, VIRTUAL_HEIGHT - mh - 14, 2, 2);
      } else if (biome === 'celestial_marble') {
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 10, 4, 10);
        ctx.fillStyle = '#fbbf2488';
        ctx.fillRect(x - 2, VIRTUAL_HEIGHT - mh - 11, 6, 2);
      } else if (biome === 'ebony_fen') {
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 8, 4, 8);
        ctx.fillStyle = '#34d39977';
        ctx.fillRect(x - 3, VIRTUAL_HEIGHT - mh - 6, 8, 3);
      } else if (biome === 'orbital_nexus') {
        ctx.fillRect(x, VIRTUAL_HEIGHT - mh - 11, 2, 11);
        ctx.fillStyle = '#67e8f988';
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 12, 4, 2);
      } else if (biome === 'twilight_garden') {
        ctx.fillRect(x - 1, VIRTUAL_HEIGHT - mh - 9, 4, 9);
        ctx.fillStyle = '#e879f977';
        ctx.fillRect(x - 3, VIRTUAL_HEIGHT - mh - 11, 8, 3);
      }
    }
  }

  // Plane 4: Near Ridge Silhouette + Subtle Edge Rim (0.58x parallax)
  for (let x = 0; x < VIRTUAL_WIDTH; x += 2) {
    const wx = x + pNear + gx * 70;
    const h =
      28 +
      Math.round(Math.sin(wx * 0.044 + 1.4) * 10 + Math.cos((wx + gy * 15) * 0.09) * 5) -
      Math.round(pNearY * 0.7);
    const nh = Math.max(10, h);
    ctx.fillStyle = meta.mountainNear;
    ctx.fillRect(x, VIRTUAL_HEIGHT - nh, 2, nh);
    ctx.fillStyle = meta.secondaryAccent + '22';
    ctx.fillRect(x, VIRTUAL_HEIGHT - nh, 2, 1);
  }

  // Distant drifting flock / sky wisps for living atmosphere
  for (let b = 0; b < 3; b++) {
    const bx = safeModIdx(Math.round(time * (14 + b * 4) + b * 110 - pMid), VIRTUAL_WIDTH + 30) - 15;
    const by = 34 + b * 14 + Math.round(Math.sin(time * 3 + b * 2) * 3);
    const wing = Math.sin(time * 9 + b) > 0 ? -1 : 1;
    ctx.fillStyle = meta.tileOutline + 'bb';
    ctx.fillRect(bx, by, 2, 1);
    ctx.fillRect(bx - 1, by + wing, 1, 1);
    ctx.fillRect(bx + 2, by + wing, 1, 1);
  }

  // Plane 4.5: Volumetric Diagonal God Rays + Mist Ribbons
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const rx = safeModIdx(42 + i * 96 - Math.round(camX * 0.45) + Math.round(Math.sin(time * 0.35 + i * 2) * 8), VIRTUAL_WIDTH + 60) - 30;
    const wTop = 14 + (i % 2) * 8;
    const grad = ctx.createLinearGradient(rx, 0, rx + 36, VIRTUAL_HEIGHT);
    grad.addColorStop(0, meta.accent + '26');
    grad.addColorStop(0.6, meta.secondaryAccent + '12');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx + wTop, 0);
    ctx.lineTo(rx + wTop + 46, VIRTUAL_HEIGHT);
    ctx.lineTo(rx + 28, VIRTUAL_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const mistDrift = Math.round(time * 9) - pNear;
  ctx.fillStyle = meta.accent + '1a';
  ctx.fillRect(0, VIRTUAL_HEIGHT - 44, VIRTUAL_WIDTH, 18);
  ctx.fillStyle = meta.tileHighlight + '22';
  ctx.fillRect(0, VIRTUAL_HEIGHT - 38, VIRTUAL_WIDTH, 9);
  ctx.fillRect(safeModIdx(mistDrift, VIRTUAL_WIDTH), VIRTUAL_HEIGHT - 46, 94, 6);
  ctx.fillRect(safeModIdx(mistDrift + 160, VIRTUAL_WIDTH), VIRTUAL_HEIGHT - 36, 82, 5);

  // Mid-air ambient motes
  for (let i = 0; i < engine.ambientMotes.length; i++) {
    const m = engine.ambientMotes[i];
    const mx = safeModIdx(Math.round(m.x - camX * 0.35), VIRTUAL_WIDTH);
    const my = safeModIdx(Math.round(m.y - camY * 0.25), VIRTUAL_HEIGHT);
    ctx.fillStyle = i % 3 === 0 ? meta.secondaryAccent + 'dd' : meta.particleColor + 'b8';
    ctx.fillRect(mx, my, i % 4 === 0 ? 2 : 1, 1);
  }
}

export function drawEnhancedForeground(
  ctx: CanvasRenderingContext2D,
  biome: BiomeId,
  time: number,
  engine: GameEngine,
  camX = 0,
  camY = 0
): void {
  const meta = BIOME_META[biome];
  const pFgX = Math.round(camX * 1.35);
  const pFgY = Math.round(camY * 0.6);

  // Plane 6: Foreground 1.35x Parallax Framing Foliage / Crystal Spires / Chains
  ctx.fillStyle = meta.tileOutline + 'dd';
  const fgStep = 64;
  for (let i = -1; i <= Math.ceil(VIRTUAL_WIDTH / fgStep) + 1; i++) {
    const slot = Math.floor(pFgX / fgStep) + i;
    const fx = slot * fgStep - pFgX;
    const hash = Math.abs(slot * 31 + 7);
    const sway = Math.round(Math.sin(time * 2.2 + slot) * 1.2);
    if (hash % 3 === 0) {
      ctx.fillRect(fx + sway, VIRTUAL_HEIGHT - 13, 4, 13);
      ctx.fillRect(fx + 5 + sway, VIRTUAL_HEIGHT - 9, 3, 9);
      ctx.fillStyle = meta.accent + '55';
      ctx.fillRect(fx + sway, VIRTUAL_HEIGHT - 13, 2, 2);
      ctx.fillStyle = meta.tileOutline + 'dd';
    } else if (hash % 3 === 1 && biome !== 'silver_ash') {
      ctx.fillRect(fx + 10, 0, 3, 9 + (hash % 6));
      ctx.fillRect(fx + 15, 0, 2, 6 + (hash % 4));
    }
  }

  // Biome Weather Particles
  if (biome === 'frostglass') {
    ctx.fillStyle = '#e6fbffbb';
    for (let i = 0; i < 24; i++) {
      const sx = safeModIdx(Math.round(i * 23 - time * 48 - pFgX * 0.7), VIRTUAL_WIDTH);
      const sy = safeModIdx(Math.round(i * 19 + time * 54 - pFgY * 0.5), VIRTUAL_HEIGHT);
      ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, 1);
    }
  } else if (biome === 'obsidian_forge') {
    for (let i = 0; i < 20; i++) {
      const ex = safeModIdx(Math.round(i * 29 + Math.sin(time * 2 + i) * 8 - pFgX * 0.5), VIRTUAL_WIDTH);
      const ey = safeModIdx(Math.round(VIRTUAL_HEIGHT - ((time * (22 + (i % 4) * 6) + i * 17) % VIRTUAL_HEIGHT)), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#ff7722cc' : '#ffe066bb';
      ctx.fillRect(ex, ey, 2, 2);
    }
  } else if (biome === 'crimson_sakura') {
    for (let i = 0; i < 24; i++) {
      const px = safeModIdx(Math.round(i * 25 - time * 32 + Math.sin(time * 2 + i) * 6 - pFgX * 0.6), VIRTUAL_WIDTH);
      const py = safeModIdx(Math.round(i * 15 + time * 26 - pFgY * 0.4), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 3 === 0 ? '#ffd1dcdd' : '#ff70a6cc';
      ctx.fillRect(px, py, 2, 1);
    }
  } else if (biome === 'sunken_cathedral') {
    for (let i = 0; i < 20; i++) {
      const bx = safeModIdx(Math.round(i * 27 + Math.sin(time * 1.8 + i) * 4 - pFgX * 0.5), VIRTUAL_WIDTH);
      const by = safeModIdx(Math.round(VIRTUAL_HEIGHT - ((time * (18 + (i % 3) * 6) + i * 21) % VIRTUAL_HEIGHT)), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#7cf2ff88' : '#ffffff99';
      ctx.fillRect(bx, by, 2, 2);
    }
  } else if (biome === 'clockwork_spire') {
    for (let i = 0; i < 18; i++) {
      const sx = safeModIdx(Math.round(i * 31 + time * 28 - pFgX * 0.5), VIRTUAL_WIDTH);
      const sy = safeModIdx(Math.round(VIRTUAL_HEIGHT - ((time * 24 + i * 19) % VIRTUAL_HEIGHT)), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#ffb84dcc' : '#66e6ffaa';
      ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, 1);
    }
  } else if (biome === 'emerald_sky') {
    for (let i = 0; i < 22; i++) {
      const lx = safeModIdx(Math.round(i * 26 - time * 36 + Math.sin(time * 3 + i) * 5 - pFgX * 0.6), VIRTUAL_WIDTH);
      const ly = safeModIdx(Math.round(i * 17 + Math.cos(time * 2 + i) * 8 + time * 12), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#57f2a8cc' : '#ffe985bb';
      ctx.fillRect(lx, ly, 2, 1);
    }
  } else if (biome === 'stormcrown') {
    ctx.fillStyle = '#a5f3fc66';
    for (let i = 0; i < 20; i++) {
      const rx = safeModIdx(Math.round(i * 31 - time * 90), VIRTUAL_WIDTH);
      const ry = safeModIdx(Math.round(i * 17 + time * 135), VIRTUAL_HEIGHT);
      ctx.fillRect(rx, ry, 1, 5);
    }
  } else if (biome === 'solar_mirage') {
    for (let i = 0; i < 20; i++) {
      const sx = safeModIdx(Math.round(i * 29 - time * 52 - pFgX * 0.6), VIRTUAL_WIDTH);
      const sy = safeModIdx(Math.round(i * 19 + Math.sin(time * 2.5 + i) * 5), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#ffd24daa' : '#ffe89988';
      ctx.fillRect(sx, sy, 2, 1);
    }
  } else if (biome === 'amethyst_crypt') {
    for (let i = 0; i < 18; i++) {
      const ax = safeModIdx(Math.round(i * 27 + Math.sin(time * 1.5 + i) * 6 - pFgX * 0.5), VIRTUAL_WIDTH);
      const ay = safeModIdx(Math.round(VIRTUAL_HEIGHT - ((time * 16 + i * 19) % VIRTUAL_HEIGHT)), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#c084fcaa' : '#38bdf888';
      ctx.fillRect(ax, ay, 2, 2);
    }
  } else if (biome === 'alchemical_labs') {
    for (let i = 0; i < 18; i++) {
      const lx = safeModIdx(Math.round(i * 26 + Math.sin(time * 2.1 + i) * 4 - pFgX * 0.5), VIRTUAL_WIDTH);
      const ly = safeModIdx(Math.round(VIRTUAL_HEIGHT - ((time * 22 + i * 21) % VIRTUAL_HEIGHT)), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#34d39999' : '#f472b699';
      ctx.fillRect(lx, ly, 2, 2);
    }
  } else if (biome === 'aurora_zenith') {
    for (let i = 0; i < 22; i++) {
      const fx = safeModIdx(Math.round(i * 23 - time * 42 - pFgX * 0.6), VIRTUAL_WIDTH);
      const fy = safeModIdx(Math.round(i * 17 + time * 38 - pFgY * 0.5), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 3 === 0 ? '#34d399cc' : i % 3 === 1 ? '#38bdf8cc' : '#f472b6bb';
      ctx.fillRect(fx, fy, 2, 1);
    }
  } else if (biome === 'crimson_canyon') {
    for (let i = 0; i < 20; i++) {
      const dx = safeModIdx(Math.round(i * 27 - time * 58 - pFgX * 0.6), VIRTUAL_WIDTH);
      const dy = safeModIdx(Math.round(i * 19 + Math.sin(time * 2.8 + i) * 7), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#fb923ccc' : '#ffe06688';
      ctx.fillRect(dx, dy, 2, 1);
    }
  } else if (biome === 'cyber_undercity') {
    for (let i = 0; i < 22; i++) {
      const cx = safeModIdx(Math.round(i * 23 - pFgX * 0.5), VIRTUAL_WIDTH);
      const cy = safeModIdx(Math.round(i * 17 + time * 95), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#22d3ee99' : '#f472b688';
      ctx.fillRect(cx, cy, 1, 4);
    }
  } else if (biome === 'celestial_marble') {
    for (let i = 0; i < 18; i++) {
      const mx = safeModIdx(Math.round(i * 29 + Math.sin(time * 1.8 + i) * 6 - pFgX * 0.5), VIRTUAL_WIDTH);
      const my = safeModIdx(Math.round(VIRTUAL_HEIGHT - ((time * 18 + i * 21) % VIRTUAL_HEIGHT)), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#fbbf24bb' : '#ffffffaa';
      ctx.fillRect(mx, my, 2, 2);
    }
  } else if (biome === 'ebony_fen') {
    for (let i = 0; i < 18; i++) {
      const wx = safeModIdx(Math.round(i * 27 + Math.sin(time * 2.2 + i) * 8 - pFgX * 0.5), VIRTUAL_WIDTH);
      const wy = safeModIdx(Math.round(VIRTUAL_HEIGHT - ((time * 15 + i * 23) % VIRTUAL_HEIGHT)), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#34d399cc' : '#a3e635aa';
      ctx.fillRect(wx, wy, 2, 2);
    }
  } else if (biome === 'orbital_nexus') {
    for (let i = 0; i < 20; i++) {
      const ox = safeModIdx(Math.round(i * 31 - time * 72 - pFgX * 0.6), VIRTUAL_WIDTH);
      const oy = safeModIdx(Math.round(i * 19 + time * 14), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#67e8f9cc' : '#ffffffbb';
      ctx.fillRect(ox, oy, 3, 1);
    }
  } else if (biome === 'twilight_garden') {
    for (let i = 0; i < 22; i++) {
      const px = safeModIdx(Math.round(i * 25 + Math.sin(time * 2 + i) * 7 - pFgX * 0.5), VIRTUAL_WIDTH);
      const py = safeModIdx(Math.round(i * 17 + time * 24 - pFgY * 0.4), VIRTUAL_HEIGHT);
      ctx.fillStyle = i % 2 === 0 ? '#e879f9cc' : '#67e8f9aa';
      ctx.fillRect(px, py, 2, 2);
    }
  }

  // Dynamic Room Weather Streaks & Tints
  const weather = engine.roomWeather;
  if (weather === 'wind_gale') {
    ctx.fillStyle = '#5eead466';
    for (let i = 0; i < 14; i++) {
      const wx = safeModIdx(Math.round(i * 31 + time * 165), VIRTUAL_WIDTH);
      const wy = (i * 19 + 7) % VIRTUAL_HEIGHT;
      ctx.fillRect(wx, wy, 14, 1);
    }
  } else if (weather === 'astral_meteor') {
    for (let i = 0; i < 8; i++) {
      const mx = safeModIdx(Math.round(i * 44 - time * 110), VIRTUAL_WIDTH);
      const my = safeModIdx(Math.round(i * 23 + time * 95), VIRTUAL_HEIGHT);
      ctx.fillStyle = '#fbbf24aa';
      ctx.fillRect(mx, my, 2, 2);
      ctx.fillStyle = '#ffffff88';
      ctx.fillRect(mx + 2, my - 2, 2, 1);
    }
  } else if (weather === 'blood_eclipse') {
    ctx.fillStyle = 'rgba(180, 20, 50, 0.08)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    for (let i = 0; i < 10; i++) {
      const ex = safeModIdx(Math.round(i * 37 - time * 36), VIRTUAL_WIDTH);
      const ey = safeModIdx(Math.round(VIRTUAL_HEIGHT - ((time * 24 + i * 29) % VIRTUAL_HEIGHT)), VIRTUAL_HEIGHT);
      ctx.fillStyle = '#fb7185aa';
      ctx.fillRect(ex, ey, 2, 2);
    }
  } else if (weather === 'aurora_blessing') {
    ctx.fillStyle = 'rgba(52, 211, 153, 0.06)';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, 42);
  }

  // Foreground 1.35x faster drifting spores / snow / embers
  ctx.fillStyle = meta.secondaryAccent + 'aa';
  for (let i = 0; i < 16; i++) {
    const m = engine.ambientMotes[i];
    if (!m) continue;
    const fx = safeModIdx(Math.round(m.x * 1.4 - pFgX + time * 12), VIRTUAL_WIDTH);
    const fy = safeModIdx(Math.round(m.y * 1.15 - pFgY), VIRTUAL_HEIGHT);
    ctx.fillRect(fx, fy, 2, 1);
  }
}

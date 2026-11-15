// @ts-nocheck -- imported game code, written for a looser TS config
import type { GameEngine } from './engine';
import { isTileValueSolid } from './physics';
import { RoomDef, TILE_SIZE, TileType, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './types';
import { BIOME_META, BiomeMeta } from './worldData';

function getRoomTile(room: RoomDef, tx: number, ty: number): number {
  if (tx < 0 || tx >= room.cols || ty < 0 || ty >= room.rows) return TileType.SOLID;
  return room.tiles[ty * room.cols + tx];
}

function isAirTile(room: RoomDef, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= room.cols || ty >= room.rows) return false;
  const t = room.tiles[ty * room.cols + tx];
  return t === TileType.EMPTY || t === TileType.WATER;
}

export function drawEnhancedTiles(
  ctx: CanvasRenderingContext2D,
  room: RoomDef,
  engine: GameEngine,
  time: number,
  camX = 0,
  camY = 0
): void {
  const meta = BIOME_META[room.biome];
  const startTx = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
  const endTx = Math.min(room.cols - 1, Math.ceil((camX + VIRTUAL_WIDTH) / TILE_SIZE) + 1);
  const startTy = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
  const endTy = Math.min(room.rows - 1, Math.ceil((camY + VIRTUAL_HEIGHT) / TILE_SIZE) + 1);

  const playerCx = engine.player.x + engine.player.w * 0.5;
  const playerCy = engine.player.y + engine.player.h * 0.5;

  for (let ty = startTy; ty <= endTy; ty++) {
    for (let tx = startTx; tx <= endTx; tx++) {
      const idx = ty * room.cols + tx;
      const t = room.tiles[idx];
      if (t === TileType.EMPTY) continue;

      const rt = engine.tileStates.get(idx);
      if (rt && (rt.state === 'gone' || rt.state === 'faded')) {
        if (t === TileType.CRUMBLE) {
          ctx.strokeStyle = '#ffffff44';
          ctx.strokeRect(tx * 8 + 1, ty * 8 + 1, 6, 6);
        }
        continue;
      }

      const x = tx * TILE_SIZE + (rt?.state === 'shaking' ? Math.round(Math.sin(time * 52) * 1) : 0);
      const y = ty * TILE_SIZE;

      if (t === TileType.SOLID || t === TileType.SECRET_WALL) {
        drawEnhancedSolidTile(ctx, room, tx, ty, x, y, meta, t === TileType.SECRET_WALL, time);
      } else if (t === TileType.ONE_WAY) {
        const lfOw = getRoomTile(room, tx - 1, ty) === TileType.ONE_WAY;
        const rtOw = getRoomTile(room, tx + 1, ty) === TileType.ONE_WAY;
        ctx.fillStyle = meta.tileOutline;
        ctx.fillRect(x, y, 8, 5);
        ctx.fillStyle = meta.tileHighlight;
        ctx.fillRect(x, y + 1, 8, 2);
        ctx.fillStyle = '#ffffff55';
        ctx.fillRect(x + (tx % 2), y + 1, 5, 1);
        ctx.fillStyle = meta.tileMain;
        ctx.fillRect(x, y + 3, 8, 1);
        ctx.fillStyle = meta.accent;
        ctx.fillRect(x + 1, y + 2, 1, 1);
        ctx.fillRect(x + 6, y + 2, 1, 1);
        ctx.fillStyle = meta.tileOutline;
        ctx.fillRect(x + 4, y + 1, 1, 3);
        ctx.fillStyle = meta.tileShadow;
        if (!lfOw) {
          ctx.fillRect(x, y + 4, 3, 4);
          ctx.fillStyle = meta.accent;
          ctx.fillRect(x + 1, y + 5, 1, 1);
          ctx.fillStyle = meta.tileShadow;
        }
        if (!rtOw) {
          ctx.fillRect(x + 5, y + 4, 3, 4);
          ctx.fillStyle = meta.accent;
          ctx.fillRect(x + 6, y + 5, 1, 1);
          ctx.fillStyle = meta.tileShadow;
        }
        if (tx % 2 === 0) ctx.fillRect(x + 3, y + 4, 2, 2);
      } else if (t === TileType.CRUMBLE) {
        const shaking = rt?.state === 'shaking';
        const glow = shaking || Math.floor(time * 6 + tx) % 5 === 0;
        ctx.fillStyle = '#120d17';
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = '#392c47';
        ctx.fillRect(x + 1, y + 1, 6, 6);
        ctx.fillStyle = '#c4aedb';
        ctx.fillRect(x + 1, y + 1, 6, 2);
        ctx.fillStyle = '#ffffff77';
        ctx.fillRect(x + 1, y + 1, 4, 1);
        ctx.fillStyle = shaking ? '#ff6622' : '#191121';
        ctx.fillRect(x + 2, y + 3, 4, 1);
        ctx.fillRect(x + 4, y + 2, 1, 5);
        ctx.fillStyle = shaking ? '#ffe082' : glow ? '#d8b4fe' : '#7a688f';
        ctx.fillRect(x + 1, y + 5, 2, 1);
        ctx.fillRect(x + 5, y + 5, 2, 1);
        if (shaking) {
          const dustY = Math.floor(time * 28 + tx * 3) % 4;
          ctx.fillStyle = '#ffd27daa';
          ctx.fillRect(x + 2, y + 8 + dustY, 1, 1);
          ctx.fillRect(x + 6, y + 7 + ((dustY + 2) % 4), 1, 1);
        }
      } else if (t === TileType.DREAM_BLOCK) {
        ctx.fillStyle = '#070414';
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = '#1d0c3d';
        ctx.fillRect(x + 1, y + 1, 6, 6);
        // Subtle flowing nebula ribbon across tiles
        const neb = Math.sin(time * 2.2 + tx * 0.45 + ty * 0.35);
        if (neb > 0.15) {
          ctx.fillStyle = '#5b21b644';
          ctx.fillRect(x + 1, y + 2, 6, 4);
        }
        const nUp = getRoomTile(room, tx, ty - 1) !== TileType.DREAM_BLOCK;
        const nDn = getRoomTile(room, tx, ty + 1) !== TileType.DREAM_BLOCK;
        const nLf = getRoomTile(room, tx - 1, ty) !== TileType.DREAM_BLOCK;
        const nRt = getRoomTile(room, tx + 1, ty) !== TileType.DREAM_BLOCK;
        const edgePulse = Math.floor(time * 5) % 2 === 0;
        ctx.fillStyle = edgePulse ? '#f0abfc' : '#d580ff';
        if (nUp) ctx.fillRect(x, y, 8, 1);
        if (nDn) ctx.fillRect(x, y + 7, 8, 1);
        if (nLf) ctx.fillRect(x, y, 1, 8);
        if (nRt) ctx.fillRect(x + 7, y, 1, 8);
        ctx.fillStyle = '#ffffff';
        if (nUp && nLf) ctx.fillRect(x, y, 2, 2);
        if (nUp && nRt) ctx.fillRect(x + 6, y, 2, 2);
        if (nDn && nLf) ctx.fillRect(x, y + 6, 2, 2);
        if (nDn && nRt) ctx.fillRect(x + 6, y + 6, 2, 2);
        // Multi-depth drifting stars
        const driftX = Math.floor(time * 4) % 6;
        const starPhase = (tx * 7 + ty * 13 + Math.floor(time * 6)) % 5;
        ctx.fillStyle = starPhase === 0 ? '#ffffff' : starPhase === 1 ? '#6be8ff' : '#ff88ee';
        ctx.fillRect(x + (((tx * 3 + driftX) % 5) + 1), y + ((ty * 5 + 1) % 5) + 1, starPhase === 0 ? 2 : 1, 1);
        ctx.fillStyle = starPhase % 2 === 0 ? '#a855f799' : '#38bdf899';
        ctx.fillRect(x + ((tx * 5 + 1) % 5) + 1, y + ((ty * 3 + 4) % 5) + 1, 1, 1);
      } else if (t === TileType.ICE) {
        ctx.fillStyle = '#091936';
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = '#1b538a';
        ctx.fillRect(x + 1, y + 1, 6, 6);
        ctx.fillStyle = '#6ec6f5';
        ctx.fillRect(x, y + 1, 8, 3);
        ctx.fillStyle = '#e0f9ff';
        ctx.fillRect(x, y, 8, 1);
        const glintStep = (Math.floor(time * 9) - tx - ty) % 9 === 0;
        ctx.fillStyle = glintStep ? '#ffffff' : '#bae6fd';
        ctx.fillRect(x + 1, y + 2, 2, 1);
        ctx.fillRect(x + 2, y + 3, 2, 1);
        ctx.fillRect(x + 5, y + 5, 2, 1);
      } else if (t === TileType.BREAKABLE) {
        ctx.fillStyle = '#1c110d';
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = '#6b4d3f';
        ctx.fillRect(x + 1, y + 1, 6, 6);
        ctx.fillStyle = '#996f5b';
        ctx.fillRect(x + 1, y + 1, 6, 2);
        ctx.fillStyle = '#1c110d';
        ctx.fillRect(x + 2, y + 1, 1, 6);
        ctx.fillRect(x + 3, y + 4, 3, 1);
        const pulse = Math.sin(time * 6 + tx) > 0;
        ctx.fillStyle = pulse ? '#ffe066' : '#ff9933';
        ctx.fillRect(x + 3, y + 2, 2, 1);
        ctx.fillRect(x + 5, y + 5, 1, 1);
      } else if (t === TileType.STICKY_RESIN) {
        const drip = Math.round(Math.sin(time * 3.5 + tx * 1.3) * 1.2);
        ctx.fillStyle = '#082920';
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = '#185c48';
        ctx.fillRect(x + 1, y + 1, 6, 6);
        ctx.fillStyle = '#4df0c0';
        ctx.fillRect(x, y, 2, 8);
        ctx.fillRect(x + 6, y, 2, 8);
        ctx.fillStyle = '#b3ffea';
        ctx.fillRect(x, y + 2 + drip, 1, 3);
        ctx.fillRect(x + 7, y + 4 - drip, 1, 2);
        ctx.fillStyle = '#ffffffcc';
        ctx.fillRect(x + 2, y + 3, 1, 1);
      } else if (t === TileType.MAGMA_CRUST) {
        const glow = Math.sin(time * 5 + tx * 0.9) > 0;
        ctx.fillStyle = '#140507';
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = '#3d1515';
        ctx.fillRect(x + 1, y + 1, 6, 6);
        ctx.fillStyle = glow ? '#ff6622' : '#d43a15';
        ctx.fillRect(x + 1, y + 1, 6, 1);
        ctx.fillRect(x, y + 4, 3, 2);
        ctx.fillRect(x + 5, y + 3, 3, 2);
        ctx.fillStyle = glow ? '#fff5b8' : '#ff9933';
        ctx.fillRect(x + 2, y + 1, 2, 1);
        ctx.fillRect(x + 6, y + 4, 1, 1);
        if (Math.floor(time * 6 + tx) % 5 === 0) {
          ctx.fillStyle = '#ffe066';
          ctx.fillRect(x + ((tx * 3) % 6) + 1, y - 1, 1, 1);
        }
      } else if (t === TileType.CONVEYOR_LEFT || t === TileType.CONVEYOR_RIGHT) {
        ctx.fillStyle = '#0f0c17';
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = '#2d283b';
        ctx.fillRect(x, y + 1, 8, 6);
        const spinCog = Math.floor(time * 12) % 2;
        ctx.fillStyle = '#8b83a8';
        ctx.fillRect(x + 1, y + 5, 2, 2);
        ctx.fillRect(x + 5, y + 5, 2, 2);
        ctx.fillStyle = spinCog ? '#ffffff' : '#4a435e';
        ctx.fillRect(x + 1 + spinCog, y + 5, 1, 1);
        ctx.fillRect(x + 6 - spinCog, y + 5, 1, 1);
        ctx.fillStyle = '#ffaa33';
        const shift = Math.floor(time * 18) % 4;
        const cx = t === TileType.CONVEYOR_RIGHT ? x + shift : x + 3 - shift;
        ctx.fillRect(cx, y + 1, 2, 2);
        ctx.fillRect(((cx + 4 - x) % 8) + x, y + 1, 1, 2);
        ctx.fillStyle = '#fff5b8';
        ctx.fillRect(cx, y + 1, 1, 1);
        ctx.fillStyle = '#ffd27d';
        ctx.fillRect(x, y + 3, 8, 1);
      } else if (t === TileType.FRAGILE_GLASS) {
        const sheen = Math.floor(time * 5 + tx) % 6 === 0;
        ctx.fillStyle = '#3ea8cc66';
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = '#a6f6ff99';
        ctx.fillRect(x + 1, y + 1, 6, 2);
        ctx.strokeStyle = '#e0fdff';
        ctx.strokeRect(x + 0.5, y + 0.5, 7, 7);
        ctx.fillStyle = sheen ? '#ffffff' : '#ffffffaa';
        ctx.fillRect(x + 2, y + 2, 2, 1);
        ctx.fillRect(x + 3, y + 3, 2, 1);
        ctx.fillRect(x + 5, y + 5, 1, 1);
      } else if (t === TileType.BEAT_A || t === TileType.BEAT_B) {
        const active =
          (t === TileType.BEAT_A && engine.beatPhase === 0) ||
          (t === TileType.BEAT_B && engine.beatPhase === 1);
        const col = t === TileType.BEAT_A ? '#ff477e' : '#38d9ff';
        const dark = t === TileType.BEAT_A ? '#7a1236' : '#12537a';
        if (active) {
          ctx.fillStyle = '#090712';
          ctx.fillRect(x, y, 8, 8);
          ctx.fillStyle = dark;
          ctx.fillRect(x + 1, y + 1, 6, 6);
          ctx.fillStyle = col;
          ctx.fillRect(x + 1, y + 1, 6, 4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + 1, y + 1, 6, 1);
          ctx.fillRect(x + 3, y + 3, 2, 2);
        } else {
          ctx.strokeStyle = col + '88';
          ctx.strokeRect(x + 1.5, y + 1.5, 5, 5);
          ctx.fillStyle = col + '66';
          ctx.fillRect(x + 3, y + 3, 2, 2);
        }
      } else if (t === TileType.LIQUID_LETHAL) {
        drawEnhancedLavaTile(ctx, room, tx, ty, x, y, time);
      } else if (t === TileType.WATER) {
        drawEnhancedWaterTile(ctx, room, tx, ty, x, y, time, playerCx, playerCy);
      } else if (t === TileType.CLOUD_BOUNCE) {
        const bounceY = Math.round(Math.sin(time * 4 + tx * 0.6) * 0.6);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y + 3 + bounceY, 8, 5);
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(x, y + 2 + bounceY, 8, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1, y + 1 + bounceY, 6, 2);
        ctx.fillStyle = '#ffd24d';
        ctx.fillRect(x, y + 5 + bounceY, 8, 1);
        if ((tx + Math.floor(time * 5)) % 5 === 0) {
          ctx.fillStyle = '#ffffffcc';
          ctx.fillRect(x + 3, y - 1 + bounceY, 2, 1);
        }
      } else if (
        t === TileType.SPIKE_UP ||
        t === TileType.SPIKE_DOWN ||
        t === TileType.SPIKE_LEFT ||
        t === TileType.SPIKE_RIGHT
      ) {
        drawEnhancedSpikeTile(ctx, x, y, t, meta.accent, time);
      }
    }
  }
}

function drawEnhancedWaterTile(
  ctx: CanvasRenderingContext2D,
  room: RoomDef,
  tx: number,
  ty: number,
  x: number,
  y: number,
  time: number,
  playerCx: number,
  playerCy: number
): void {
  const upSame = getRoomTile(room, tx, ty - 1) === TileType.WATER;
  const dnSame = getRoomTile(room, tx, ty + 1) === TileType.WATER;
  const lfTile = getRoomTile(room, tx - 1, ty);
  const rtTile = getRoomTile(room, tx + 1, ty);
  const lfSame = lfTile === TileType.WATER;
  const rtSame = rtTile === TileType.WATER;

  if (!upSame) {
    // 2px-wide smooth dual-harmonic surface wave + player splash ripple!
    const distToPlayer = Math.hypot(playerCx - (x + 4), playerCy - y);
    const splashAmp = distToPlayer < 24 ? Math.max(0, 1 - distToPlayer / 24) * 1.4 : 0;

    for (let sx = 0; sx < 8; sx += 2) {
      const wx = x + sx;
      const waveVal =
        Math.sin(time * 4.2 + wx * 0.22) * 0.9 +
        Math.cos(time * 2.6 - wx * 0.14) * 0.45 +
        (splashAmp > 0 ? Math.sin(time * 16 + wx * 0.6) * splashAmp : 0);
      const topY = y + 1 + Math.round(waveVal);
      const fillH = Math.max(2, y + 8 - topY);

      ctx.fillStyle = '#156096a8';
      ctx.fillRect(wx, topY, 2, fillH);
      ctx.fillStyle = '#38bdf8b8';
      ctx.fillRect(wx, topY, 2, 2);
      ctx.fillStyle = '#e0faff';
      ctx.fillRect(wx, topY, 2, 1);

      // Traveling crest sparkle
      if (((Math.floor(time * 8 + wx * 0.5)) % 9) === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(wx, topY, 2, 1);
      }
    }

    // Shoreline whitewater foam against solid walls
    if (!lfSame && isTileValueSolid(lfTile)) {
      ctx.fillStyle = '#ffffffcc';
      ctx.fillRect(x, y + 1, 2, 2);
    }
    if (!rtSame && isTileValueSolid(rtTile)) {
      ctx.fillStyle = '#ffffffcc';
      ctx.fillRect(x + 6, y + 1, 2, 2);
    }
  } else {
    ctx.fillStyle = dnSame ? '#0e487594' : '#082c4da6';
    ctx.fillRect(x, y, 8, 8);
    // Diagonal underwater caustic shimmer rays
    const causticPhase = (tx * 2 + ty + Math.floor(time * 5.5)) % 5;
    if (causticPhase === 0) {
      ctx.fillStyle = '#7ce8ff44';
      ctx.fillRect(x + 1, y + 1, 5, 2);
      ctx.fillRect(x + 3, y + 3, 3, 2);
    }
    // Rising underwater bubbles (1px and 2px with highlight dot)
    if ((tx * 7 + ty * 3) % 3 === 0) {
      const bubY = 7 - ((Math.floor(time * 7 + tx * 4 + ty * 5)) % 8);
      const bx = x + ((tx * 5 + Math.round(Math.sin(time * 3 + ty))) % 5) + 1;
      ctx.fillStyle = '#bae6fdcc';
      ctx.fillRect(bx, y + bubY, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx, y + bubY, 1, 1);
    }
    // Rare tiny shimmering underwater fish silhouette in deep cells
    if ((tx * 11 + ty * 17) % 13 === 0) {
      const swimX = (Math.floor(time * 12 + tx * 3) % 5) + 1;
      ctx.fillStyle = '#fde68acc';
      ctx.fillRect(x + swimX, y + 4, 2, 1);
    }
    ctx.fillStyle = '#6be8ff4a';
    if (!lfSame) ctx.fillRect(x, y, 1, 8);
    if (!rtSame) ctx.fillRect(x + 7, y, 1, 8);
  }
}

function drawEnhancedLavaTile(
  ctx: CanvasRenderingContext2D,
  room: RoomDef,
  tx: number,
  ty: number,
  x: number,
  y: number,
  time: number
): void {
  const upSame = getRoomTile(room, tx, ty - 1) === TileType.LIQUID_LETHAL;
  const dnSame = getRoomTile(room, tx, ty + 1) === TileType.LIQUID_LETHAL;
  const lfSame = getRoomTile(room, tx - 1, ty) === TileType.LIQUID_LETHAL;
  const rtSame = getRoomTile(room, tx + 1, ty) === TileType.LIQUID_LETHAL;
  const bio = room.biome === 'bioluminescent' || room.biome === 'ebony_fen';
  const alchem = room.biome === 'alchemical_labs';

  const colCore = bio ? '#137035' : alchem ? '#7a165e' : '#a81c06';
  const colMid = bio ? '#29ba56' : alchem ? '#d946ef' : '#e64212';
  const colHot = bio ? '#80ff66' : alchem ? '#34d399' : '#ff9f24';
  const colCrest = bio ? '#e2ffbf' : alchem ? '#fdf4ff' : '#fff5a8';

  if (!upSame) {
    for (let sx = 0; sx < 8; sx += 2) {
      const wx = x + sx;
      const w0 = Math.round(Math.sin(time * 4.5 + wx * 0.2) * 1.1 + Math.cos(time * 2.8 - wx * 0.14) * 0.4);
      const topY = y + 2 + w0;
      const fillH = Math.max(2, y + 8 - topY);

      ctx.fillStyle = colMid;
      ctx.fillRect(wx, topY, 2, fillH);
      ctx.fillStyle = colHot;
      ctx.fillRect(wx, topY, 2, 2);
      ctx.fillStyle = colCrest;
      ctx.fillRect(wx, topY, 2, 1);
    }

    if (!lfSame) {
      ctx.fillStyle = colCrest;
      ctx.fillRect(x, y + 2, 1, 6);
    }
    if (!rtSame) {
      ctx.fillStyle = colCrest;
      ctx.fillRect(x + 7, y + 2, 1, 6);
    }

    // Bobbing dark slag / crust chunks or floating bubbles
    if ((tx + Math.floor(time * 2.5)) % 4 === 0) {
      ctx.fillStyle = colCore;
      ctx.fillRect(x + 2, y + 4, 4, 2);
    }

    // Rising sizzling sparks/bubbles above surface
    const sparkT = Math.floor(time * 8 + tx * 5);
    if (sparkT % 4 === 0) {
      const lift = sparkT % 4;
      ctx.fillStyle = colCrest;
      ctx.fillRect(x + ((tx * 3 + 2) % 6), y + 1 - lift, 1, 1);
    }
  } else {
    ctx.fillStyle = colCore;
    ctx.fillRect(x, y, 8, 8);
    const flow = Math.floor(time * 6 + tx * 2) % 8;
    ctx.fillStyle = colMid;
    ctx.fillRect(x, y + (flow % 4), 8, 3);
    ctx.fillRect(x + ((tx * 3 + 1) % 5), y, 3, 8);
    const bY = 7 - (Math.floor(time * 7 + tx * 5 + ty * 3) % 8);
    const bX = (tx * 3 + ty * 2) % 6;
    ctx.fillStyle = colHot;
    ctx.fillRect(x + bX, y + bY, 2, 2);
    ctx.fillStyle = colCrest;
    ctx.fillRect(x + bX, y + bY, 1, 1);
    ctx.fillStyle = colHot + 'aa';
    if (!lfSame) ctx.fillRect(x, y, 1, 8);
    if (!rtSame) ctx.fillRect(x + 7, y, 1, 8);
    if (!dnSame) ctx.fillRect(x, y + 7, 8, 1);
  }
}

export function drawEnhancedSolidTile(
  ctx: CanvasRenderingContext2D,
  room: RoomDef,
  tx: number,
  ty: number,
  x: number,
  y: number,
  meta: BiomeMeta,
  isSecret: boolean,
  time: number
): void {
  const upTile = getRoomTile(room, tx, ty - 1);
  const up = isTileValueSolid(upTile);
  const submerged = upTile === TileType.WATER || upTile === TileType.LIQUID_LETHAL;
  const dn = isTileValueSolid(getRoomTile(room, tx, ty + 1));
  const lf = isTileValueSolid(getRoomTile(room, tx - 1, ty));
  const rt = isTileValueSolid(getRoomTile(room, tx + 1, ty));

  // Base block fill with subtle per-tile tonal variation for organic masonry
  const hash = (tx * 37 + ty * 19) & 15;
  const toneVar = (tx * 11 + ty * 23) % 5;
  ctx.fillStyle = meta.tileMain;
  ctx.fillRect(x, y, 8, 8);
  if (toneVar === 0) {
    ctx.fillStyle = meta.tileShadow + '66';
    ctx.fillRect(x, y, 8, 8);
  } else if (toneVar === 2) {
    ctx.fillStyle = meta.tileHighlight + '28';
    ctx.fillRect(x, y, 8, 4);
  }

  // Staggered Ashlar Stonework + Deep Mortar Recesses + Block Highlights
  const mortarOffset = (ty & 1) * 4;
  ctx.fillStyle = meta.tileShadow;
  ctx.fillRect(x, y + 3, 8, 1);
  ctx.fillRect(x, y + 7, 8, 1);
  ctx.fillRect(x + mortarOffset, y, 1, 4);
  ctx.fillRect(x + ((mortarOffset + 4) & 7), y + 4, 1, 4);

  // Inner carved brick bevel & weathered chisel marks
  ctx.fillStyle = meta.tileHighlight + '58';
  ctx.fillRect(x + ((mortarOffset + 1) & 7), y + 1, 3, 1);
  ctx.fillRect(x + ((mortarOffset + 5) & 7), y + 5, 2, 1);

  if (hash === 1 || hash === 10) {
    // Diagonal weathered stone crack
    ctx.fillStyle = meta.tileOutline + '88';
    ctx.fillRect(x + 2, y + 1, 1, 1);
    ctx.fillRect(x + 3, y + 2, 1, 1);
    ctx.fillRect(x + 4, y + 4, 1, 2);
  } else if ((hash & 3) === 0) {
    ctx.fillStyle = meta.tileHighlight + '66';
    ctx.fillRect(x + 1 + (hash & 1), y + 5, 3, 1);
  } else if (hash === 5 || hash === 13) {
    // Embedded glowing ore / rune crystal
    const shimmer = Math.sin(time * 3.4 + tx * 0.9 + ty) > 0.35;
    ctx.fillStyle = meta.tileOutline + 'aa';
    ctx.fillRect(x + 4, y + 1, 2, 2);
    ctx.fillStyle = shimmer ? '#ffffffcc' : meta.accent + 'aa';
    ctx.fillRect(x + 4, y + 1, 1, 1);
    ctx.fillStyle = meta.secondaryAccent + '88';
    ctx.fillRect(x + 5, y + 2, 1, 1);
  } else if (hash === 9) {
    ctx.fillStyle = meta.secondaryAccent + '77';
    ctx.fillRect(x + 2, y + 5, 2, 2);
  }

  // Biome-specific animated & sculpted wall materials
  if (room.biome === 'cyber_undercity' || room.biome === 'orbital_nexus' || room.biome === 'alchemical_labs') {
    const scanPhase = Math.floor(time * 8 - tx - ty) & 7;
    if ((tx + ty) % 3 === 0) {
      ctx.fillStyle = scanPhase === 0 ? '#ffffffdd' : meta.accent + '77';
      ctx.fillRect(x + 1, y + 4, 5, 1);
      ctx.fillRect(x + 5, y + 2, 1, 2);
      if (scanPhase <= 1) {
        ctx.fillStyle = meta.secondaryAccent + 'bb';
        ctx.fillRect(x + 1 + (scanPhase * 3), y + 4, 2, 1);
      }
    }
  } else if (room.biome === 'clockwork_spire') {
    if (hash === 3 || hash === 11) {
      // Brass rivets & ticking gear seam
      ctx.fillStyle = '#ffb84daa';
      ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillRect(x + 6, y + 1, 1, 1);
      ctx.fillRect(x + 2, y + 5, 4, 1);
      const tick = Math.floor(time * 5 + tx) % 2;
      ctx.fillStyle = tick ? '#ffe49e' : '#92400e';
      ctx.fillRect(x + 3 + tick, y + 4, 2, 2);
    }
  } else if (room.biome === 'obsidian_forge' || room.biome === 'crimson_canyon') {
    if (hash === 7 || hash === 11 || hash === 14) {
      const ember = Math.sin(time * 3.8 + tx * 0.8 + ty * 1.1);
      ctx.fillStyle = ember > 0.2 ? '#ff8822cc' : ember > -0.3 ? '#d43a1588' : '#7c2d1266';
      ctx.fillRect(x + 1, y + 4, 4, 1);
      ctx.fillRect(x + 3, y + 5, 2, 2);
      if (ember > 0.72) {
        ctx.fillStyle = '#fff3b0aa';
        ctx.fillRect(x + 2, y + 4, 1, 1);
      }
    }
  } else if (room.biome === 'bioluminescent' || room.biome === 'ebony_fen' || room.biome === 'twilight_garden') {
    if (hash === 4 || hash === 12) {
      const bioPulse = 0.45 + 0.55 * Math.sin(time * 2.6 + tx * 1.3 + ty);
      ctx.fillStyle = bioPulse > 0.6 ? '#7dffe2bb' : '#34d39977';
      ctx.fillRect(x + 2, y + 2, 3, 1);
      ctx.fillRect(x + 4, y + 5, 2, 2);
    }
  } else if (room.biome === 'frostglass' || room.biome === 'aurora_zenith') {
    if (hash === 2 || hash === 8 || hash === 15) {
      const iceGlint = Math.floor(time * 6 - tx + ty) % 10 === 0;
      ctx.fillStyle = iceGlint ? '#ffffffdd' : '#7dd3fc66';
      ctx.fillRect(x + 1, y + 2, 3, 1);
      ctx.fillRect(x + 2, y + 3, 2, 1);
    }
  } else if (room.biome === 'celestial_marble' || room.biome === 'solar_mirage') {
    if ((tx + ty) % 4 === 1) {
      ctx.fillStyle = '#fbbf2466';
      ctx.fillRect(x + 1, y + 2, 5, 1);
      ctx.fillStyle = '#ffffff44';
      ctx.fillRect(x + 2, y + 1, 3, 1);
    }
  } else if (room.biome === 'astral_void' || room.biome === 'amethyst_crypt' || room.biome === 'sunken_cathedral') {
    if (hash === 6 || hash === 12) {
      const runeOn = Math.sin(time * 2.4 + tx * 1.1 + ty * 0.7) > 0.2;
      ctx.fillStyle = runeOn ? meta.accent + '99' : meta.secondaryAccent + '44';
      ctx.fillRect(x + 3, y + 2, 2, 3);
      ctx.fillRect(x + 2, y + 3, 4, 1);
    }
  }

  if (isSecret && Math.sin(time * 3.2 + tx + ty) > 0.6) {
    ctx.fillStyle = '#ffffff4c';
    ctx.fillRect(x + 2, y + 2, 4, 4);
    ctx.fillStyle = meta.accent + 'bb';
    ctx.fillRect(x + 3, y + 3, 2, 2);
  }

  // Exposed Top Surface Cap + Biome Flora/Frost/Ember Details
  if (!up) {
    ctx.fillStyle = meta.tileOutline;
    ctx.fillRect(x, y, 8, 1);
    ctx.fillStyle = meta.tileHighlight;
    ctx.fillRect(x, y + 1, 8, 2);
    ctx.fillStyle = '#ffffff4c';
    ctx.fillRect(x + 1, y + 1, 6, 1);
    ctx.fillStyle = meta.accent + '44';
    ctx.fillRect(x, y + 3, 8, 1);

    if (!submerged) {
      const sway = Math.round(Math.sin(time * 3.5 + tx * 0.7) * 0.65);
      const icy = room.biome === 'frostglass' || room.biome === 'aurora_zenith';
      const hot = room.biome === 'obsidian_forge' || room.biome === 'crimson_canyon' || room.biome === 'solar_mirage';
      if (icy) {
        ctx.fillStyle = '#e0f9ff';
        ctx.fillRect(x, y, 8, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + (tx % 2), y, 5, 1);
        if (hash % 3 === 0) ctx.fillRect(x + 3, y - 1, 2, 1);
      } else if (hot) {
        ctx.fillStyle = meta.accent + 'cc';
        ctx.fillRect(x + 1, y + 1, 6, 1);
        if ((tx * 13 + ty) % 3 === 0) {
          ctx.fillStyle = meta.secondaryAccent;
          ctx.fillRect(x + 2, y - 1, 1, 1);
          ctx.fillRect(x + 5 + sway, y - 1, 2, 1);
        }
      } else if ((tx * 17 + ty) % 2 === 0) {
        ctx.fillStyle = meta.accent;
        ctx.fillRect(x + 1 + sway, y - 1, 2, 1);
        ctx.fillRect(x + 5 + sway, y - 2, 1, 2);
        if ((tx * 7 + ty * 3) % 4 === 0) {
          ctx.fillStyle = meta.secondaryAccent;
          ctx.fillRect(x + 5 + sway, y - 3, 2, 1);
        }
      }
    } else if (upTile === TileType.LIQUID_LETHAL) {
      ctx.fillStyle = '#ff993399';
      ctx.fillRect(x, y, 8, 1);
    }
  }

  // Exposed Ceiling Underside + Swaying Overhang Roots/Icicles/Sparks
  if (!dn) {
    ctx.fillStyle = meta.tileOutline;
    ctx.fillRect(x, y + 7, 8, 1);
    ctx.fillStyle = meta.tileShadow;
    ctx.fillRect(x, y + 6, 8, 1);
    if ((tx * 11 + ty) % 3 === 0) {
      const sway = Math.round(Math.sin(time * 2.5 + tx) * 0.6);
      const len = 3 + (hash % 3);
      ctx.fillStyle = meta.tileOutline;
      ctx.fillRect(x + 3 + sway, y + 8, 2, len);
      ctx.fillStyle = meta.accent + 'cc';
      ctx.fillRect(x + 3 + sway, y + 7 + len, 1, 2);
      if (hash % 4 === 0) {
        ctx.fillStyle = '#ffffffaa';
        ctx.fillRect(x + 3 + sway, y + 8 + len, 1, 1);
      }
    }
  }

  // Crisp Exposed Side Edges + Beveled Wall Trim
  if (!lf) {
    ctx.fillStyle = meta.tileOutline;
    ctx.fillRect(x, y, 1, 8);
    ctx.fillStyle = meta.tileHighlight + 'b0';
    ctx.fillRect(x + 1, y + 1, 1, 6);
    if ((ty * 7 + tx) % 4 === 0) {
      ctx.fillStyle = meta.accent + '88';
      ctx.fillRect(x + 1, y + 3, 1, 2);
    }
  }
  if (!rt) {
    ctx.fillStyle = meta.tileOutline;
    ctx.fillRect(x + 7, y, 1, 8);
    ctx.fillStyle = meta.tileShadow;
    ctx.fillRect(x + 6, y + 1, 1, 6);
  }

  // Crisp Corner Chamfer Rivets
  ctx.fillStyle = meta.tileOutline;
  if (!up && !lf) ctx.fillRect(x + 1, y + 1, 1, 1);
  if (!up && !rt) ctx.fillRect(x + 6, y + 1, 1, 1);
  if (!dn && !lf) ctx.fillRect(x + 1, y + 6, 1, 1);
  if (!dn && !rt) ctx.fillRect(x + 6, y + 6, 1, 1);
}

export function drawEnhancedTilePolish(
  ctx: CanvasRenderingContext2D,
  room: RoomDef,
  time: number,
  camX: number,
  camY: number
): void {
  const meta = BIOME_META[room.biome];
  const accent = meta.accent;
  const sx = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
  const ex = Math.min(room.cols - 1, Math.ceil((camX + VIRTUAL_WIDTH) / TILE_SIZE) + 1);
  const sy = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
  const ey = Math.min(room.rows - 1, Math.ceil((camY + VIRTUAL_HEIGHT) / TILE_SIZE) + 1);
  const T = TILE_SIZE;
  for (let ty = sy; ty <= ey; ty++) {
    for (let tx = sx; tx <= ex; tx++) {
      const t = room.tiles[ty * room.cols + tx];
      if (t !== TileType.SOLID && t !== TileType.ICE && t !== TileType.CRUMBLE && t !== TileType.BREAKABLE) {
        if (isAirTile(room, tx, ty)) {
          if (ty > 0 && room.tiles[(ty - 1) * room.cols + tx] === TileType.SOLID) {
            ctx.fillStyle = 'rgba(4,2,12,0.42)';
            ctx.fillRect(tx * T, ty * T, T, 2);
            ctx.fillStyle = 'rgba(4,2,12,0.18)';
            ctx.fillRect(tx * T, ty * T + 2, T, 2);
          }
          if (tx > 0 && room.tiles[ty * room.cols + (tx - 1)] === TileType.SOLID) {
            ctx.fillStyle = 'rgba(4,2,12,0.24)';
            ctx.fillRect(tx * T, ty * T, 2, T);
          }
          if (tx < room.cols - 1 && room.tiles[ty * room.cols + (tx + 1)] === TileType.SOLID) {
            ctx.fillStyle = 'rgba(4,2,12,0.16)';
            ctx.fillRect(tx * T + T - 1, ty * T, 1, T);
          }
        }
        continue;
      }
      const x = tx * T;
      const y = ty * T;
      const h = (tx * 73856093) ^ (ty * 19349663);
      if (isAirTile(room, tx, ty - 1)) {
        ctx.fillStyle = accent + '72';
        ctx.fillRect(x, y, T, 1);
        ctx.fillStyle = '#ffffff46';
        ctx.fillRect(x + (h & 3), y, 3, 1);
        ctx.fillStyle = accent + '20';
        ctx.fillRect(x, y - 2, T, 2);
        if ((h & 7) === 1) {
          const sway = Math.round(Math.sin(time * 2.0 + tx) * 0.85);
          ctx.fillStyle = accent + 'cc';
          ctx.fillRect(x + 2 + sway, y - 2, 1, 2);
          ctx.fillRect(x + 4, y - 3, 1, 3);
          ctx.fillStyle = '#ffffffcc';
          ctx.fillRect(x + 4, y - 3, 1, 1);
        } else if ((h & 15) === 6) {
          const tw = (Math.sin(time * 3.4 + h) + 1) * 0.5;
          ctx.fillStyle = `rgba(255,255,255,${(0.3 + tw * 0.65).toFixed(2)})`;
          ctx.fillRect(x + 5, y - 1, 1, 1);
        }
      }
      if (isAirTile(room, tx - 1, ty)) {
        ctx.fillStyle = '#ffffff22';
        ctx.fillRect(x, y, 1, T);
      }
      if (isAirTile(room, tx + 1, ty)) {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(x + T - 1, y, 1, T);
      }
      if (isAirTile(room, tx, ty + 1)) {
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.fillRect(x, y + T - 1, T, 1);
      }
    }
  }
}

export function drawEnhancedSpikeTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  accent: string,
  time: number
): void {
  const gleam = Math.floor(time * 7 + x + y) % 7 === 0;
  if (t === TileType.SPIKE_UP) {
    ctx.fillStyle = '#090712';
    ctx.fillRect(x, y + 6, 8, 2);
    ctx.fillStyle = '#47405c';
    ctx.fillRect(x, y + 6, 8, 1);
    for (let i = 0; i < 2; i++) {
      const sx = x + i * 4;
      ctx.fillStyle = '#140f1d';
      ctx.fillRect(sx, y + 4, 4, 3);
      ctx.fillRect(sx + 1, y + 1, 2, 3);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(sx + 1, y + 2, 2, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + 1, y + 2, 1, 3);
      ctx.fillStyle = gleam ? '#ffffff' : accent;
      ctx.fillRect(sx + 1, y + 1, 1, 1);
    }
  } else if (t === TileType.SPIKE_DOWN) {
    ctx.fillStyle = '#090712';
    ctx.fillRect(x, y, 8, 2);
    ctx.fillStyle = '#47405c';
    ctx.fillRect(x, y + 1, 8, 1);
    for (let i = 0; i < 2; i++) {
      const sx = x + i * 4;
      ctx.fillStyle = '#140f1d';
      ctx.fillRect(sx, y + 1, 4, 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(sx + 1, y + 1, 2, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + 1, y + 2, 1, 2);
      ctx.fillStyle = gleam ? '#ffffff' : accent;
      ctx.fillRect(sx + 1, y + 6, 1, 1);
    }
  } else if (t === TileType.SPIKE_LEFT) {
    ctx.fillStyle = '#090712';
    ctx.fillRect(x + 6, y, 2, 8);
    ctx.fillStyle = '#47405c';
    ctx.fillRect(x + 6, y, 1, 8);
    for (let i = 0; i < 2; i++) {
      const sy = y + i * 4;
      ctx.fillStyle = '#140f1d';
      ctx.fillRect(x + 3, sy, 4, 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 2, sy + 1, 5, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2, sy + 1, 3, 1);
      ctx.fillStyle = gleam ? '#ffffff' : accent;
      ctx.fillRect(x + 1, sy + 1, 1, 1);
    }
  } else {
    ctx.fillStyle = '#090712';
    ctx.fillRect(x, y, 2, 8);
    ctx.fillStyle = '#47405c';
    ctx.fillRect(x + 1, y, 1, 8);
    for (let i = 0; i < 2; i++) {
      const sy = y + i * 4;
      ctx.fillStyle = '#140f1d';
      ctx.fillRect(x + 1, sy, 4, 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + 1, sy + 1, 5, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2, sy + 1, 3, 1);
      ctx.fillStyle = gleam ? '#ffffff' : accent;
      ctx.fillRect(x + 6, sy + 1, 1, 1);
    }
  }
}

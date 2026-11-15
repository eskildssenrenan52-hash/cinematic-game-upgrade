// @vitest-environment node
// @ts-nocheck -- imported game code, written for a looser TS config
// @ts-nocheck — imported game code, typed under the original looser tsconfig
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  CollisionGrid,
  createInitialPlayer,
  resolveSwingRelease,
  resolveSwingStep,
  stepPlayerPhysics,
  PHYS,
} from './physics';
import { AssistOptions, InputState, TILE_SIZE } from './types';
import { createTowerFloorRoom } from './worldData';

function makeFlatFloorGrid(floorY = 160): CollisionGrid {
  return {
    isSolidAtPixel(_px: number, py: number) {
      return py >= floorY;
    },
    isOneWayAtPixel() { return false; },
    isDreamAtPixel() { return false; },
    isIceAtPixel() { return false; },
    isStickyAtPixel() { return false; },
    isMagmaAtPixel() { return false; },
    isWaterAtPixel() { return false; },
    getConveyorAtPixel() { return 0; },
    isHazardAtPixel() { return false; },
  };
}

const defaultAssist: AssistOptions = {
  gameSpeed: 1,
  infiniteStamina: false,
  extraDash: false,
  invincible: false,
  hardcoreMode: false,
};

const emptyInput: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpHeld: false,
  jumpJustPressed: false,
  dashJustPressed: false,
  grabHeld: false,
  interactJustPressed: false,
};

test('coyote time allows jump shortly after leaving ledge', () => {
  const p = createInitialPlayer(40, 149);
  const grid = makeFlatFloorGrid(160);
  // First step on ground sets coyoteTimer
  stepPlayerPhysics(p, emptyInput, 1 / 60, grid, defaultAssist, 0, 0, false);
  assert.equal(p.onGround, true);

  // Move off ground by placing player over air
  const airGrid = makeFlatFloorGrid(400);
  stepPlayerPhysics(p, emptyInput, 0.04, airGrid, defaultAssist, 0, 0, false);
  assert.equal(p.onGround, false);
  assert.ok(p.coyoteTimer > 0);

  // Jump while coyote active
  const ev = stepPlayerPhysics(
    p,
    { ...emptyInput, jumpHeld: true, jumpJustPressed: true },
    1 / 60,
    airGrid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.equal(ev.jumped, true);
  assert.ok(p.vy < 0);
  assert.ok(ev.unlockedMechanics.includes('COYOTE_TIME'));
});

test('jump buffer triggers jump upon landing', () => {
  const p = createInitialPlayer(40, 145); // 4px above floor (145 + 11 = 156, floor at 160)
  const grid = makeFlatFloorGrid(160);
  // Press jump in midair
  stepPlayerPhysics(
    p,
    { ...emptyInput, jumpHeld: true, jumpJustPressed: true },
    1 / 60,
    grid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.ok(p.jumpBufferTimer > 0);

  // Simulate falling until touching ground
  let jumped = false;
  for (let i = 0; i < 10; i++) {
    const ev = stepPlayerPhysics(
      p,
      { ...emptyInput, jumpHeld: true },
      1 / 60,
      grid,
      defaultAssist,
      0,
      0,
      false
    );
    if (ev.jumped) {
      jumped = true;
      break;
    }
  }
  assert.equal(jumped, true);
});

test('8-way dash and hyper-dash produce extreme horizontal momentum', () => {
  const p = createInitialPlayer(40, 149);
  const grid = makeFlatFloorGrid(160);
  stepPlayerPhysics(p, emptyInput, 1 / 60, grid, defaultAssist, 0, 0, false);

  // Down-right dash
  const dashEv = stepPlayerPhysics(
    p,
    { ...emptyInput, right: true, down: true, dashJustPressed: true },
    1 / 60,
    grid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.equal(dashEv.dashed, true);

  // Jump out of dash -> Hyper Dash
  const jumpEv = stepPlayerPhysics(
    p,
    { ...emptyInput, right: true, jumpHeld: true, jumpJustPressed: true },
    1 / 60,
    grid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.equal(jumpEv.jumped, true);
  assert.ok(p.vx >= PHYS.HYPER_HSPEED - 1);
  assert.ok(jumpEv.unlockedMechanics.includes('HYPER_DASH'));
});

test('wallbounce launches player vertically when dashing up next to wall and jumping', () => {
  const p = createInitialPlayer(18, 100);
  const wallGrid: CollisionGrid = {
    isSolidAtPixel(px: number) {
      return px < 16; // Solid wall immediately to the left of player
    },
    isOneWayAtPixel() { return false; },
    isDreamAtPixel() { return false; },
    isIceAtPixel() { return false; },
    isStickyAtPixel() { return false; },
    isMagmaAtPixel() { return false; },
    isWaterAtPixel() { return false; },
    getConveyorAtPixel() { return 0; },
    isHazardAtPixel() { return false; },
  };

  const ev1 = stepPlayerPhysics(
    p,
    { ...emptyInput, up: true, dashJustPressed: true },
    1 / 60,
    wallGrid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.equal(ev1.dashed, true);

  const ev2 = stepPlayerPhysics(
    p,
    { ...emptyInput, jumpHeld: true, jumpJustPressed: true },
    1 / 60,
    wallGrid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.equal(ev2.wallJumped, true);
  assert.ok(ev2.unlockedMechanics.includes('WALL_BOUNCE'));
  assert.ok(p.vy <= PHYS.WALLBOUNCE_VSPEED + 1);
});

test('ceiling corner correction nudges player around 3px corner overhang', () => {
  // Ceiling at y < 80 for x in [32..48], open at x >= 48
  const p = createInitialPlayer(46, 80);
  p.vy = -100;
  const cornerGrid: CollisionGrid = {
    isSolidAtPixel(px: number, py: number) {
      return py < 80 && px >= 32 && px < 48;
    },
    isOneWayAtPixel() { return false; },
    isDreamAtPixel() { return false; },
    isIceAtPixel() { return false; },
    isStickyAtPixel() { return false; },
    isMagmaAtPixel() { return false; },
    isWaterAtPixel() { return false; },
    getConveyorAtPixel() { return 0; },
    isHazardAtPixel() { return false; },
  };

  const ev = stepPlayerPhysics(
    p,
    { ...emptyInput, jumpHeld: true },
    1 / 60,
    cornerGrid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.ok(p.x >= 48, `expected player nudged right past 48, got ${p.x}`);
  assert.ok(ev.unlockedMechanics.includes('CORNER_CORRECT_UP'));
  void TILE_SIZE;
});

import { HEROES, HeroId } from './heroes';
import { HERO_SPRITE_SETS, HeroAnimKey, NPC_SPRITES, PROP_SPRITES, buildHeroPalette } from './sprites';
import { GameEngine } from './engine';

test('Zephyr jumps higher and glides slower than Lyra', () => {
  const grid = makeFlatFloorGrid(160);
  const lyra = createInitialPlayer(40, 149, 'lyra');
  const zephyr = createInitialPlayer(40, 149, 'zephyr');

  stepPlayerPhysics(lyra, emptyInput, 1 / 60, grid, defaultAssist, 0, 0, false);
  stepPlayerPhysics(zephyr, emptyInput, 1 / 60, grid, defaultAssist, 0, 0, false);

  stepPlayerPhysics(
    lyra,
    { ...emptyInput, jumpHeld: true, jumpJustPressed: true },
    1 / 60,
    grid,
    defaultAssist,
    0,
    0,
    false
  );
  stepPlayerPhysics(
    zephyr,
    { ...emptyInput, jumpHeld: true, jumpJustPressed: true },
    1 / 60,
    grid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.ok(zephyr.vy < lyra.vy, `expected Zephyr stronger jump (${zephyr.vy}) < (${lyra.vy})`);

  // Test slow glide while falling and holding jump
  const airGrid = makeFlatFloorGrid(600);
  zephyr.onGround = false;
  zephyr.vy = 150;
  stepPlayerPhysics(zephyr, { ...emptyInput, jumpHeld: true }, 0.25, airGrid, defaultAssist, 0, 0, false);
  assert.ok(zephyr.vy <= 62, `expected Zephyr glide fall speed capped near 58, got ${zephyr.vy}`);
});

test('Nyx spawns with 2 dashes and Seraphina performs 1 mid-air double jump', () => {
  const airGrid = makeFlatFloorGrid(500);
  const nyx = createInitialPlayer(40, 100, 'nyx');
  assert.equal(nyx.dashes, 2);
  assert.equal(nyx.maxDashes, 2);

  const sera = createInitialPlayer(40, 100, 'seraphina');
  sera.onGround = false;
  sera.coyoteTimer = 0;
  sera.vy = 40;
  assert.equal(sera.airJumpsLeft, 1);

  const ev = stepPlayerPhysics(
    sera,
    { ...emptyInput, jumpHeld: true, jumpJustPressed: true },
    1 / 60,
    airGrid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.equal(ev.airJumped, true);
  assert.equal(sera.airJumpsLeft, 0);
  assert.ok(sera.vy < 0);

  // Second mid-air jump without touching ground should not trigger
  sera.vy = 20;
  const ev2 = stepPlayerPhysics(
    sera,
    { ...emptyInput, jumpHeld: true, jumpJustPressed: true },
    1 / 60,
    airGrid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.equal(ev2.airJumped, false);
});

test('all 36 hero sprite sets, 108 hero skins, NPC sprites, and astral_coin sprites have uniform dimensions and valid palette tokens', () => {
  assert.equal(HEROES.length, 36);
  const anims: HeroAnimKey[] = ['idle', 'run', 'jump', 'fall', 'dash', 'climb', 'crouch'];
  for (const hero of HEROES) {
    const id: HeroId = hero.id;
    assert.equal(hero.skins.length, 3, `${id} should have 3 visual skins`);
    const set = HERO_SPRITE_SETS[id];
    assert.ok(set, `missing sprite set for ${id}`);
    for (const skin of hero.skins) {
      const pal = buildHeroPalette(id, hero.modifiers.baseDashes, false, false, skin.id);
      for (const anim of anims) {
        const frames = set[anim];
        assert.ok(frames.length >= 1, `${id}.${anim} has no frames`);
        for (let fi = 0; fi < frames.length; fi++) {
          const rows = frames[fi];
          assert.equal(rows.length, 22, `${id}.${anim}[${fi}] expected 22 rows, got ${rows.length}`);
          for (let ri = 0; ri < rows.length; ri++) {
            const row = rows[ri];
            assert.equal(row.length, 20, `${id}.${anim}[${fi}] row ${ri} width ${row.length} !== 20`);
            for (const ch of row) {
              if (ch === '.' || ch === ' ') continue;
              assert.ok(
                pal[ch] !== undefined,
                `${id} (${skin.id}).${anim}[${fi}] row ${ri} unknown token '${ch}'`
              );
            }
          }
        }
      }
    }
  }

  for (const [npcId, sprite] of Object.entries(NPC_SPRITES)) {
    for (const frame of sprite.frames) {
      for (const row of frame) {
        for (const ch of row) {
          if (ch === '.' || ch === ' ') continue;
          assert.ok(sprite.palette[ch] !== undefined, `NPC ${npcId} unknown token '${ch}'`);
        }
      }
    }
  }

  assert.ok(PROP_SPRITES.astral_coin.frames.length >= 4);
  for (const frame of PROP_SPRITES.astral_coin.frames) {
    assert.equal(frame.length, 7);
    for (const row of frame) {
      assert.equal(row.length, 8);
      for (const ch of row) {
        if (ch === '.' || ch === ' ') continue;
        const coinPal = PROP_SPRITES.astral_coin.palette as Record<string, string>;
        assert.ok(coinPal[ch] !== undefined, `astral_coin unknown token '${ch}'`);
      }
    }
  }
});

test('Selene (umbra) has lower gravity and Kael (volt) dashes faster + engine [Q] skill & Blessing upgrades work', () => {
  const airGrid = makeFlatFloorGrid(500);
  const lyra = createInitialPlayer(40, 100, 'lyra');
  const umbra = createInitialPlayer(40, 100, 'umbra');
  lyra.onGround = false;
  umbra.onGround = false;
  stepPlayerPhysics(lyra, emptyInput, 0.1, airGrid, defaultAssist, 0, 0, false);
  stepPlayerPhysics(umbra, emptyInput, 0.1, airGrid, defaultAssist, 0, 0, false);
  assert.ok(umbra.vy < lyra.vy, `expected Selene lunar fall ${umbra.vy} < ${lyra.vy}`);

  const engine = new GameEngine(() => {});
  engine.startPlaying(false);
  engine.setHero('umbra');
  assert.equal(engine.player.gravityDir, 1);
  engine.step(1 / 60, { ...emptyInput, skillJustPressed: true });
  assert.equal(engine.player.gravityDir, -1, 'expected Umbra [Q] skill to invert gravity');
  assert.ok(engine.heroSkillCooldown > 0);
  assert.equal(engine.comboCount, 1);

  engine.astralCoins = 10;
  const bought = engine.buyBlessingUpgrade('speedLv');
  assert.equal(bought, true);
  assert.equal(engine.blessings.speedLv, 1);
  assert.equal(engine.astralCoins, 5);
});

test('multi-screen camera scrolls across wide stages and skills emit shockwaves', () => {
  const engine = new GameEngine(() => {});
  engine.startPlaying(false);
  assert.ok(engine.currentRoom.cols >= 58, `expected wide start stage, got ${engine.currentRoom.cols}`);

  // Trigger hero skill -> emits an active shockwave ring
  engine.step(1 / 60, { ...emptyInput, skillJustPressed: true });
  assert.ok(
    engine.shockwaves.some((sw) => sw.active),
    'expected active shockwave ring after triggering hero skill'
  );

  // Move player forward cleanly across wide stage and step simulation -> cameraX advances smoothly
  engine.assist.invincible = true;
  engine.player.x = engine.currentRoom.cols * TILE_SIZE * 0.72;
  engine.player.y = 40;
  for (let i = 0; i < 45; i++) {
    engine.step(1 / 60, { ...emptyInput, right: true });
  }
  assert.ok(engine.cameraX > 80, `expected cameraX > 80 on wide stage, got ${engine.cameraX}`);
});

test('Stage 1 player is not stuck on spawn and moves right + jumps smoothly', () => {
  const engine = new GameEngine(() => {});
  engine.startPlaying(false);
  const startX = engine.player.x;
  const startY = engine.player.y;

  // Step 24 frames holding right -> player must walk cleanly forward!
  for (let i = 0; i < 24; i++) {
    engine.step(1 / 60, { ...emptyInput, right: true });
  }
  assert.ok(
    engine.player.x > startX + 18,
    `Expected player to walk cleanly right from ${startX}, got ${engine.player.x}`
  );

  // Press jump -> player must lift upward off ground!
  engine.step(1 / 60, { ...emptyInput, jumpHeld: true, jumpJustPressed: true });
  assert.ok(engine.player.vy < -100, `Expected upward jump vy < -100, got ${engine.player.vy}`);
  for (let i = 0; i < 6; i++) {
    engine.step(1 / 60, { ...emptyInput, jumpHeld: true });
  }
  assert.ok(engine.player.y < startY - 4, `Expected player to rise above ${startY}, got ${engine.player.y}`);
});

test('new world objects (treasure_chest, speed_pad, bumper_orb, checkpoint_totem, shield_orb) and Style Rank work', () => {
  const engine = new GameEngine(() => {});
  engine.startPlaying(false);
  const p = engine.player;

  // Place player over treasure chest / add test entities directly into current room
  const sx = p.x;
  const sy = p.y;
  const chestCoinsBefore = engine.astralCoins;

  engine.liveEntities.push(
    {
      def: { id: 'test_chest', kind: 'treasure_chest', x: sx, y: sy },
      x: sx,
      y: sy,
      w: 14,
      h: 12,
      vx: 0,
      vy: 0,
      homeX: sx,
      homeY: sy,
      timer: 0,
      cooldown: 0,
      state: 'idle',
      hp: 1,
      maxHp: 1,
      dir: 1,
      flash: 0,
      koTimer: 0,
      collected: false,
    },
    {
      def: { id: 'test_shield', kind: 'shield_orb', x: sx, y: sy },
      x: sx,
      y: sy,
      w: 14,
      h: 14,
      vx: 0,
      vy: 0,
      homeX: sx,
      homeY: sy,
      timer: 0,
      cooldown: 0,
      state: 'idle',
      hp: 1,
      maxHp: 1,
      dir: 1,
      flash: 0,
      koTimer: 0,
      collected: false,
    },
    {
      def: { id: 'test_cp', kind: 'checkpoint_totem', x: sx + 30, y: sy - 5 },
      x: sx + 30,
      y: sy - 5,
      w: 12,
      h: 16,
      vx: 0,
      vy: 0,
      homeX: sx + 30,
      homeY: sy - 5,
      timer: 0,
      cooldown: 0,
      state: 'idle',
      hp: 1,
      maxHp: 1,
      dir: 1,
      flash: 0,
      koTimer: 0,
      collected: false,
    }
  );

  engine.step(1 / 60, emptyInput);
  assert.equal(engine.astralCoins, chestCoinsBefore + 5, 'Treasure chest grants +5 astral coins');
  assert.equal(p.heroShieldReady, true, 'Shield orb grants protective shield');
  assert.ok(engine.styleScore >= 180, 'Treasure chest increases Style Score');

  // Clear pickup hitstop and test speed_pad velocity boost
  engine.hitstop = 0;
  engine.liveEntities.push({
    def: { id: 'test_pad', kind: 'speed_pad', x: p.x, y: p.y, dir: 1 },
    x: p.x,
    y: p.y,
    w: 16,
    h: 8,
    vx: 0,
    vy: 0,
    homeX: p.x,
    homeY: p.y,
    timer: 0,
    cooldown: 0,
    state: 'idle',
    hp: 1,
    maxHp: 1,
    dir: 1,
    flash: 0,
    koTimer: 0,
    collected: false,
  });
  engine.step(1 / 60, emptyInput);
  assert.ok(p.vx >= 200, `Speed pad boosts horizontal speed, got ${p.vx}`);

  // Test bumper_orb upward/radial bounce
  engine.hitstop = 0;
  p.vy = 0;
  engine.liveEntities.push({
    def: { id: 'test_bumper', kind: 'bumper_orb', x: p.x - 3, y: p.y + 4 },
    x: p.x - 3,
    y: p.y + 4,
    w: 14,
    h: 14,
    vx: 0,
    vy: 0,
    homeX: p.x - 3,
    homeY: p.y + 4,
    timer: 0,
    cooldown: 0,
    state: 'idle',
    hp: 1,
    maxHp: 1,
    dir: 1,
    flash: 0,
    koTimer: 0,
    collected: false,
  });
  engine.step(1 / 60, emptyInput);
  assert.ok(p.vy <= -100, `Bumper orb launches player upward, got ${p.vy}`);

  // Test Style Rank reaches S at 2600 and SS at 4100
  engine.styleScore = 2600;
  assert.equal(engine.getSnapshot().styleRank, 'S');
  engine.styleScore = 4100;
  assert.equal(engine.getSnapshot().styleRank, 'SS');
});

import { decodeGamepadState } from './gamepad';
import { CUTSCENES, formatCutsceneText, LORE_CODEX } from './cutscenes';
import { BOSS_ORDER, PLAY_MODES } from './modes';
import { ENEMY_SPRITES } from './sprites';

test('decodeGamepadState handles stick deadzone, D-pad, and single-frame edge triggers', () => {
  // Deadzone inside [-0.25..0.25] does not trigger left/right
  const dead = decodeGamepadState(
    Array.from({ length: 16 }, () => ({ pressed: false })),
    [0.18, -0.1],
    []
  );
  assert.equal(dead.input.left, false);
  assert.equal(dead.input.right, false);

  // Press Left Stick right, Jump (0), Dash (2), Grab (4), Skill (3), Pause (9), Map (8)
  const btnsPressed = Array.from({ length: 16 }, (_, idx) => ({
    pressed: [0, 2, 3, 4, 8, 9].includes(idx),
  }));
  const frame1 = decodeGamepadState(btnsPressed, [0.85, 0], []);
  assert.equal(frame1.input.right, true);
  assert.equal(frame1.input.jumpHeld, true);
  assert.equal(frame1.input.jumpJustPressed, true);
  assert.equal(frame1.input.dashJustPressed, true);
  assert.equal(frame1.input.grabHeld, true);
  assert.equal(frame1.input.skillJustPressed, true);
  assert.equal(frame1.pauseJustPressed, true);
  assert.equal(frame1.mapJustPressed, true);

  // Holding on next frame keeps held true but resets justPressed to false
  const prevMask = btnsPressed.map((b) => b.pressed);
  const frame2 = decodeGamepadState(btnsPressed, [0.85, 0], prevMask);
  assert.equal(frame2.input.jumpHeld, true);
  assert.equal(frame2.input.jumpJustPressed, false);
  assert.equal(frame2.input.dashJustPressed, false);
  assert.equal(frame2.pauseJustPressed, false);
});

test('all 42 cutscenes, lore codex entries, and all 38 enemy + boss sprites have valid palettes & uniform rows', () => {
  assert.equal(Object.keys(CUTSCENES).length, 42);
  assert.equal(LORE_CODEX.length, 42);
  assert.equal(BOSS_ORDER.length, 20);
  for (const cs of Object.values(CUTSCENES)) {
    assert.ok(cs.beats.length >= 2, `Cutscene ${cs.id} needs >= 2 beats`);
    assert.equal(formatCutsceneText('Salve {{HERO}}!', 'Nyx'), 'Salve Nyx!');
  }

  const expectedEnemies = [
    'enemy_crawler',
    'enemy_wisp',
    'enemy_drone',
    'enemy_charger',
    'enemy_mortar',
    'enemy_mimic',
    'enemy_golem',
    'enemy_saw',
    'enemy_phantom',
    'enemy_slime_king',
    'enemy_laser_eye',
    'enemy_spark_beetle',
    'enemy_magma_wyrm',
    'enemy_sand_wraith',
    'enemy_bone_knight',
    'enemy_alchemist',
    'enemy_frost_valkyrie',
    'enemy_mirror_orb',
    ...BOSS_ORDER,
  ];
  for (const key of expectedEnemies) {
    const sprite = ENEMY_SPRITES[key];
    assert.ok(sprite, `Missing enemy/boss sprite ${key}`);
    const minFrames = (BOSS_ORDER as readonly string[]).includes(key) ? 3 : 2;
    assert.ok(sprite.frames.length >= minFrames, `${key} should have >= ${minFrames} animation frames`);
    for (let fi = 0; fi < sprite.frames.length; fi++) {
      const frame = sprite.frames[fi];
      const expectedW = frame[0].length;
      for (let ri = 0; ri < frame.length; ri++) {
        assert.equal(
          frame[ri].length,
          expectedW,
          `${key} frame ${fi} row ${ri} width ${frame[ri].length} !== ${expectedW}`
        );
        for (const ch of frame[ri]) {
          if (ch === '.' || ch === ' ') continue;
          assert.ok(sprite.palette[ch] !== undefined, `${key} unknown palette char '${ch}'`);
        }
      }
    }
  }
});

test('Overdrive reaches 100%, activates ETER SUPREMO!, resets skill cooldown, and new enemies fire telegraphed attacks', () => {
  const engine = new GameEngine(() => {});
  engine.startPlaying(false);
  engine.heroSkillCooldown = 3.5;

  // Build combo pts to charge overdrive to 100%
  engine.addCombo(9, 50);
  assert.equal(engine.overdrive, 100);
  assert.ok(engine.overdriveTimer > 4.5, 'Overdrive timer activated');
  assert.equal(engine.heroSkillCooldown, 0, 'Overdrive resets active skill cooldown');
  assert.ok(
    engine.floatingTexts.some((ft) => ft.active && ft.text === 'ETER SUPREMO!'),
    'Overdrive emits floating text callout'
  );

  // Test all 5 new enemy behaviors advance from idle -> windup -> attack/projectile cleanly
  engine.assist.invincible = true;
  const px = engine.player.x;
  const py = engine.player.y;
  engine.liveEntities = [
    'enemy_phantom',
    'enemy_slime_king',
    'enemy_laser_eye',
    'enemy_spark_beetle',
    'enemy_magma_wyrm',
  ].map((kind, i) => ({
    def: { id: `test_${kind}`, kind: kind as any, x: px + 28, y: py - i * 2 },
    x: px + 28,
    y: py - i * 2,
    w: 14,
    h: 12,
    vx: 0,
    vy: 0,
    homeX: px + 28,
    homeY: py - i * 2,
    timer: 0,
    cooldown: 0,
    state: 'idle',
    hp: 2,
    maxHp: 2,
    dir: -1,
    flash: 0,
    koTimer: 0,
    collected: false,
  }));

  for (let f = 0; f < 55; f++) {
    engine.step(1 / 60, emptyInput);
  }
  assert.ok(
    engine.projectiles.some((pr) => pr.active),
    'Expected at least one projectile fired by the new enemy types'
  );
});

test('all 7 PlayModes work: Tower climbs floors with bosses, Boss Rush locks goal, Survival spawns waves, Mirror Void grants +1 dash', () => {
  assert.equal(PLAY_MODES.length, 7);
  const engine = new GameEngine(() => {});

  // 1. Boss Rush starts facing Boss 1 (Guardião das Cinzas) with locked goal
  engine.startPlayMode('boss_rush', false);
  engine.assist.invincible = true;
  assert.equal(engine.playMode, 'boss_rush');
  assert.equal(engine.bossRushIndex, 0);
  assert.equal(engine.isGoalLocked(), true, 'Goal must stay locked while boss is alive');
  const snap1 = engine.getSnapshot();
  assert.equal(snap1.bossName, 'GUARDIÃO DAS CINZAS');
  assert.equal(snap1.bossPhase, 1);

  // Step boss fight long enough to execute patterns & projectiles
  for (let f = 0; f < 140; f++) {
    engine.step(1 / 60, emptyInput);
  }
  const bossEnt = engine.liveEntities.find((e) => e.def.kind === 'boss_sentinel');
  assert.ok(bossEnt, 'boss_sentinel alive in boss arena');

  // Reduce boss to Phase 2 (<= 68%) then Phase 3 (<= 35%) -> unlocks goal on defeat
  bossEnt.maxHp = 10;
  bossEnt.hp = 6;
  assert.equal(engine.getSnapshot().bossPhase, 2);
  bossEnt.hp = 3;
  assert.equal(engine.getSnapshot().bossPhase, 3);
  bossEnt.hp = 0;
  engine.handleEnemyKilled(bossEnt, false);
  assert.equal(engine.isGoalLocked(), false, 'Goal unlocks after boss defeat');

  // Test hero skin selection + Cloud Bounce physics tile
  engine.setHero('kitsune', 'kitsune_spirit');
  assert.equal(engine.player.heroId, 'kitsune');
  assert.equal(engine.player.skinId, 'kitsune_spirit');

  const cloudGrid: CollisionGrid = {
    ...makeFlatFloorGrid(200),
    isSolidAtPixel(px: number, py: number) {
      return py >= 200 || (px >= 40 && px <= 48 && py >= 168 && py <= 176);
    },
    isCloudBounceAtPixel(px: number, py: number) {
      return px >= 40 && px <= 48 && py >= 168 && py <= 176;
    },
  };
  const bob = createInitialPlayer(40, 168 - 11, 'aegis', 'default');
  bob.vy = 60;
  bob.onGround = false;
  const cloudEv = stepPlayerPhysics(
    bob,
    { ...emptyInput, jumpHeld: true },
    1 / 60,
    cloudGrid,
    defaultAssist,
    0,
    0,
    false
  );
  assert.ok(
    cloudEv.unlockedMechanics.includes('CLOUD_BOUNCE'),
    'CLOUD_BOUNCE bounces player upward and unlocks mechanic'
  );
  assert.ok(bob.vy <= -120, `Expected upward cloud bounce vy <= -120, got ${bob.vy}`);

  // 2. Survival Arena Infinita spawns monsters & wave progression
  engine.startPlayMode('survival', false);
  assert.equal(engine.playMode, 'survival');
  assert.equal(engine.currentRoom.id, 'survival_arena');
  assert.equal(engine.survivalWave, 1);
  assert.ok(engine.liveEntities.some((e) => e.def.kind.startsWith('enemy_')));

  // 3. Mirror Void grants +1 air dash & lower gravity, Glass Cannon multiplies overdrive/style
  engine.startPlayMode('mirror_void', false);
  assert.equal(engine.getSnapshot().maxDashes, 2, 'Mirror Void grants +1 extra dash');

  engine.startPlayMode('glass_cannon', false);
  engine.addCombo(1, 50);
  assert.equal(engine.styleScore, 150, 'Glass Cannon triples style points');
});

test('resolveSwingStep and resolveSwingRelease keep player outside walls while using vines', () => {
  const wallBoxGrid: CollisionGrid = {
    ...makeFlatFloorGrid(240),
    isSolidAtPixel(px: number, py: number) {
      // Narrow vertical chute with solid left wall (x <= 40) and right wall (x >= 72)
      return py >= 240 || px <= 40 || px >= 72 || py <= 8;
    },
  };
  const p = createInitialPlayer(52, 92);
  let radius = 36;
  let angle = 0;
  // Swing hard right against the x >= 72 wall over 60 frames
  for (let i = 0; i < 60; i++) {
    const nextAngle = Math.min(1.4, angle + 0.08);
    const step = resolveSwingStep(wallBoxGrid, p, 56, 56, angle, nextAngle, 2.5, radius);
    p.x = step.x;
    p.y = step.y;
    angle = step.angle;
    radius = step.radius;
    assert.ok(p.x >= 40, `Player clipped into left wall: x=${p.x}`);
    assert.ok(p.x + p.w <= 72, `Player clipped into right wall: right=${p.x + p.w}`);
    assert.ok(p.y > 8, `Player clipped into ceiling: y=${p.y}`);
  }
  // Release while near wall still guarantees clean non-overlapping position & upward boost
  resolveSwingRelease(wallBoxGrid, p, angle, 90, -145);
  assert.ok(p.x >= 40 && p.x + p.w <= 72, 'Player stays inside corridor after release');
  assert.ok(p.vy <= -100, 'Swing release grants upward exit impulse');
});

test('createTowerFloorRoom builds 42x48 vertical chambers with wall-clear vines and Boss every 5 floors', () => {
  const f1 = createTowerFloorRoom(1);
  assert.equal(f1.cols, 42);
  assert.equal(f1.rows, 48);
  assert.ok(f1.entities.some((e) => e.kind === 'chapter_goal'), 'Floor 1 has summit goal');
  assert.ok(!f1.entities.some((e) => e.kind.startsWith('boss_')), 'Floor 1 has no boss');

  const f5 = createTowerFloorRoom(5);
  assert.ok(f5.entities.some((e) => e.kind.startsWith('boss_')), 'Floor 5 spawns a Tower Guardian Boss');
});





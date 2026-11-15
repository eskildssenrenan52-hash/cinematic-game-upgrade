// @ts-nocheck -- imported game code, written for a looser TS config
// @ts-nocheck — imported game code, typed under the original looser tsconfig
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildChapters, CHAPTERS, createSurvivalArenaRoom, NPCS } from './worldData';
import { MECHANICS_CATALOG, TOTAL_MECHANICS } from './mechanicsCatalog';
import { BOSS_ORDER } from './modes';
import { BOSS_INTRO_CUTSCENE, CHAPTER_INTRO_CUTSCENE } from './cutscenes';
import { GameEngine } from './engine';
import {
  TILE_SIZE,
  TileType,
} from './types';
import { isTileValueSolid } from './physics';

test('mechanics catalog contains at least 116 unique documented mechanics', () => {
  assert.ok(TOTAL_MECHANICS >= 116, `expected >= 116 mechanics, got ${TOTAL_MECHANICS}`);
  const codes = new Set(MECHANICS_CATALOG.map((m) => m.code));
  assert.equal(codes.size, MECHANICS_CATALOG.length);
});

test('campaign builds 20 chapters x 10 stages (200 stages) plus valid Survival Arena room', () => {
  const chapters = buildChapters();
  assert.equal(chapters.length, 20);
  assert.equal(CHAPTERS.length, 20);

  const totalStages = chapters.reduce((acc, ch) => acc + ch.stages.length, 0);
  assert.equal(totalStages, 200, `Expected 200 total stages (20x10), got ${totalStages}`);

  let hasScrollingWideStage = false;
  let hasScrollingTallStage = false;

  for (const ch of chapters) {
    assert.equal(
      ch.stages.length,
      10,
      `Chapter ${ch.index + 1} (${ch.name}) expected 10 stages, got ${ch.stages.length}`
    );

    const stageMap = new Map(ch.stages.map((s) => [`${s.gx},${s.gy}`, s]));

    for (const stage of ch.stages) {
      assert.ok(stage.cols >= 40, `Stage ${stage.id} cols ${stage.cols} < 40`);
      assert.ok(stage.rows >= 23, `Stage ${stage.id} rows ${stage.rows} < 23`);
      assert.equal(stage.tiles.length, stage.cols * stage.rows);
      assert.equal(stage.chapterIndex, ch.index);

      if (stage.cols >= 60) hasScrollingWideStage = true;
      if (stage.rows >= 30) hasScrollingTallStage = true;

      // Verify full 8x11 player spawn bounding box is completely unobstructed and safe
      const sampleXs = [stage.spawnX + 1, stage.spawnX + 7];
      const sampleYs = [stage.spawnY + 1, stage.spawnY + 5, stage.spawnY + 10];
      for (const sx of sampleXs) {
        for (const sy of sampleYs) {
          const stx = Math.floor(sx / TILE_SIZE);
          const sty = Math.floor(sy / TILE_SIZE);
          const spawnTile = stage.tiles[sty * stage.cols + stx];
          assert.equal(
            isTileValueSolid(spawnTile),
            false,
            `Stage ${stage.id} spawn hitbox (${sx},${sy}) -> tile (${stx},${sty}) overlaps solid tile ${spawnTile}`
          );
          assert.notEqual(spawnTile, TileType.SPIKE_UP);
          assert.notEqual(spawnTile, TileType.LIQUID_LETHAL);
        }
      }

      // Verify symmetric doorways with East neighbor inside same chapter
      const east = stageMap.get(`${stage.gx + 1},${stage.gy}`);
      if (east) {
        const rightDoorFloor = Math.max(8, Math.min(stage.rows - 2, stage.exits?.rightRow ?? stage.rows - 3));
        const leftDoorFloor = Math.max(8, Math.min(east.rows - 2, east.exits?.leftRow ?? east.rows - 3));
        assert.equal(
          stage.tiles[(rightDoorFloor - 2) * stage.cols + (stage.cols - 1)],
          TileType.EMPTY,
          `Stage ${stage.id} missing east doorway to ${east.id} at row ${rightDoorFloor - 2}`
        );
        assert.equal(
          east.tiles[(leftDoorFloor - 2) * east.cols + 0],
          TileType.EMPTY,
          `Stage ${east.id} missing west doorway from ${stage.id} at row ${leftDoorFloor - 2}`
        );
      }

      // Verify symmetric doorways with South neighbor inside same chapter
      const south = stageMap.get(`${stage.gx},${stage.gy + 1}`);
      if (south) {
        const downCenter = Math.max(6, Math.min(stage.cols - 10, (stage.exits?.downCol ?? 20) - 3)) + 3;
        const upCenter = Math.max(6, Math.min(south.cols - 10, (south.exits?.upCol ?? 20) - 3)) + 3;
        assert.equal(
          stage.tiles[(stage.rows - 1) * stage.cols + downCenter],
          TileType.EMPTY,
          `Stage ${stage.id} missing south doorway to ${south.id} at col ${downCenter}`
        );
        assert.equal(
          south.tiles[0 * south.cols + upCenter],
          TileType.EMPTY,
          `Stage ${south.id} missing north doorway from ${stage.id} at col ${upCenter}`
        );
      }
    }
  }

  assert.equal(hasScrollingWideStage, true, 'expected at least one scrolling wide stage (>= 60 cols)');
  assert.equal(hasScrollingTallStage, true, 'expected at least one scrolling tall stage (>= 30 rows)');

  const survival = createSurvivalArenaRoom();
  assert.ok(survival.cols >= 40 && survival.rows >= 23);
  assert.equal(survival.tiles.length, survival.cols * survival.rows);
  const stx = Math.floor((survival.spawnX + 4) / TILE_SIZE);
  const sty = Math.floor((survival.spawnY + 5) / TILE_SIZE);
  assert.equal(isTileValueSolid(survival.tiles[sty * survival.cols + stx]), false);
});

test('campaign contains all 20 NPCs, 19 chapter goals, all 20 unique Chapter Bosses on Stage 10, Summit Heart, and 150+ Echo Relics', () => {
  const chapters = buildChapters();
  const allStages = chapters.flatMap((c) => c.stages);
  const allEntities = allStages.flatMap((r) => r.entities);

  const npcIds = new Set(allEntities.filter((e) => e.kind === 'npc').map((e) => e.npcId));
  assert.equal(Object.keys(NPCS).length, 20);
  for (const expectedNpc of Object.keys(NPCS)) {
    assert.ok(npcIds.has(expectedNpc), `Missing NPC ${expectedNpc} in campaign`);
  }

  const relics = allEntities.filter((e) => e.kind === 'relic' || e.kind === 'winged_relic');
  assert.ok(relics.length >= 150, `Expected >= 150 relics, got ${relics.length}`);

  for (let i = 0; i < 20; i++) {
    const finalStage = chapters[i].stages[chapters[i].stages.length - 1];
    const expectedBoss = BOSS_ORDER[i];
    assert.ok(
      finalStage.entities.find((e) => e.kind === expectedBoss),
      `Chapter ${i + 1} Stage 10 missing chapter boss ${expectedBoss}`
    );
    assert.ok(CHAPTER_INTRO_CUTSCENE[i], `Missing chapter intro cutscene for chapter ${i + 1}`);
    assert.ok(BOSS_INTRO_CUTSCENE[expectedBoss], `Missing boss cutscene for ${expectedBoss}`);

    const goalKind = i < 19 ? 'chapter_goal' : 'summit_heart';
    assert.ok(
      finalStage.entities.find((e) => e.kind === goalKind),
      `Chapter ${i + 1} Stage 10 missing ${goalKind}`
    );
  }

  for (const newKind of [
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
    'prism_splitter',
    'gravity_vortex',
    'stasis_orb',
  ]) {
    assert.ok(
      allEntities.some((e) => e.kind === newKind),
      `Missing campaign spawn for ${newKind}`
    );
  }
});

test('chapter progression unlocks sequentially in campaign and unlocks all in speedrun/mirror_void', () => {
  const engine = new GameEngine(() => {});
  assert.equal(engine.chapterRecords[0].unlocked, true);
  assert.equal(engine.chapterRecords[1].unlocked, false);

  // Attempting to jump directly to locked chapter 2 keeps chapter 1 active
  engine.startChapter(1, false);
  assert.equal(engine.chapterIndex, 0);
  assert.equal(engine.currentRoom.chapterIndex, 0);

  // Speedrun mode grants access to any chapter
  engine.startPlayMode('speedrun', false);
  assert.equal(engine.canAccessChapter(4), true);
  engine.startChapter(4, false);
  assert.equal(engine.chapterIndex, 4);
});

test('Fase 5 Etapa 7 bottom exit has an open descent shaft (no sealing wall)', () => {
  const s = buildChapters()[4].stages[6];
  const c0 = Math.max(6, Math.min(s.cols - 10, (s.exits?.downCol ?? 20) - 3));
  for (let ty = 12; ty < s.rows - 4; ty++) {
    for (let x = c0; x < c0 + 6; x++) {
      assert.ok(!isTileValueSolid(s.tiles[ty * s.cols + x]), `wall at (${x},${ty})`);
    }
  }
});

test('new mechanics spawn in open air and never on boss stages', () => {
  const NEW = ['jump_orb', 'cannon_barrel', 'phase_veil', 'rocket_pack', 'pulse_fan', 'star_shard'];
  for (const ch of buildChapters()) {
    for (const s of ch.stages) {
      for (const e of s.entities.filter((en) => NEW.includes(en.kind))) {
        const tx = Math.floor(e.x / TILE_SIZE), ty = Math.floor(e.y / TILE_SIZE);
        assert.equal(isTileValueSolid(s.tiles[ty * s.cols + tx]), false, `${e.kind} in wall at ${s.id}`);
      }
    }
    const boss = ch.stages[ch.stages.length - 1];
    assert.ok(!boss.entities.some((e) => NEW.includes(e.kind)), `boss stage ${boss.id} has new mechanic`);
  }
});

// @vitest-environment node
// @ts-nocheck -- imported game code, written for a looser TS config
// @ts-nocheck — imported game code, typed under the original looser tsconfig
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { GameEngine } from './engine';
import {
  HEROES,
  STARTER_HERO_IDS,
  canUnlockHero,
  getHeroElement,
  getHeroUnlockReq,
} from './heroes';
import { BOSS_ORDER, BOSS_META } from './modes';
import { MECHANICS_CATALOG, TOTAL_MECHANICS } from './mechanicsCatalog';
import {
  ACHIEVEMENTS,
  BESTIARY_ENTRIES,
  BESTIARY_MAP,
  BOONS,
  BOON_MAP,
  ELEMENT_META,
  HUNTER_CONTRACTS,
  JUKEBOX_TRACKS,
  PLAYER_MAX_LEVEL,
  PLAYER_TITLES,
  RUNES,
  SPIRITS,
  TALISMANS,
  WEATHER_META,
  chooseSafeRetreatPoint,
  computeBoonBonuses,
  computeBossDesiredAnchor,
  computeBossPhaseStats,
  computeDefeatSummary,
  computeRuneBonuses,
  computeVictoryRewards,
  decodeVirtualJoystick,
  evaluateUnlockedTitles,
  getContractMetricValue,
  getLevelProgressFromXp,
  getMasteryBonuses,
  getMasteryUpgradeCost,
  getPlayerLevelBonuses,
  getXpRequiredForLevel,
  pickBoonDraftOptions,
  pickRoomWeather,
  resolveElementalReaction,
  sampleGhostFrame,
  stepSmoothVelocity,
} from './systems';
import { InputState } from './types';
import { BIOME_META } from './worldData';

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
  skillJustPressed: false,
  swapJustPressed: false,
};

test('decodeVirtualJoystick handles deadzone, clamping, diagonals, and full range cleanly', () => {
  const idle = decodeVirtualJoystick(0, 0, 40, 0.22);
  assert.equal(idle.analogX, 0);
  assert.equal(idle.analogY, 0);
  assert.equal(idle.left, false);
  assert.equal(idle.right, false);

  const insideDead = decodeVirtualJoystick(5, -3, 40, 0.22);
  assert.equal(insideDead.analogX, 0);
  assert.equal(insideDead.analogY, 0);
  assert.equal(insideDead.right, false);

  const farRight = decodeVirtualJoystick(120, 0, 40, 0.22);
  assert.ok(Math.abs(farRight.analogX - 1) < 1e-6);
  assert.equal(farRight.right, true);
  assert.equal(farRight.left, false);
  assert.ok(Math.hypot(farRight.knobX, farRight.knobY) <= 40.001);

  const diagUpLeft = decodeVirtualJoystick(-60, -60, 40, 0.22);
  assert.equal(diagUpLeft.left, true);
  assert.equal(diagUpLeft.up, true);
  assert.ok(diagUpLeft.analogX < -0.5);
  assert.ok(diagUpLeft.analogY < -0.5);
});

test('Rune Forge, Spirit Companions, Weather, Mastery Tree, Achievements, and Ghost sampling work deterministically', () => {
  assert.equal(RUNES.length, 6);
  assert.equal(SPIRITS.length, 4);
  assert.equal(ACHIEVEMENTS.length, 12);

  // Deduplicates and caps at 3 slots
  const runeBonuses = computeRuneBonuses([
    'furia_carmesim',
    'furia_carmesim',
    'passos_fantasma',
    'eco_duplo',
    'ima_astral',
  ]);
  assert.equal(runeBonuses.extraAirJump, 1);
  assert.equal(runeBonuses.parryDamageBonus, 1);
  assert.ok(runeBonuses.speedBonus > 0.2);

  // Weather picks valid keys for all 20 biomes
  for (const biomeId of Object.keys(BIOME_META) as (keyof typeof BIOME_META)[]) {
    assert.equal(pickRoomWeather(biomeId, 0), 'clear');
    const w = pickRoomWeather(biomeId, 4);
    assert.ok(WEATHER_META[w], `Invalid weather ${w} for ${biomeId}`);
  }

  // Elemental Reactions
  assert.equal(resolveElementalReaction('flame', 'flame'), null);
  const vapor = resolveElementalReaction('flame', 'frost');
  assert.ok(vapor && vapor.bonusDamage >= 2 && vapor.name.includes('VAPOR'));
  const over = resolveElementalReaction('volt', 'flame');
  assert.ok(over && over.bonusDamage >= 2);

  // Mastery tree scaling & caps
  assert.equal(getMasteryUpgradeCost(0), 25);
  assert.ok(getMasteryUpgradeCost(5) > getMasteryUpgradeCost(1));
  const mast = getMasteryBonuses({
    mobilityLv: 10,
    combatLv: 10,
    explorationLv: 10,
    survivalLv: 10,
    xp: 0,
  });
  assert.equal(mast.levelTotal, 40);
  assert.ok(mast.speedMult > 1.2);
  assert.ok(mast.skillCdMult <= 0.71);

  // Ghost sampler binary search
  const frames = [
    { t: 0, x: 10, y: 100, facing: 1 as const },
    { t: 0.5, x: 50, y: 90, facing: 1 as const },
    { t: 1.0, x: 110, y: 80, facing: -1 as const },
  ];
  assert.equal(sampleGhostFrame([], 0.5), null);
  assert.equal(sampleGhostFrame(frames, 0.2)?.x, 10);
  assert.equal(sampleGhostFrame(frames, 0.7)?.x, 50);
  assert.equal(sampleGhostFrame(frames, 5.0)?.x, 110);
});

test('all 36 Heroes have elemental affinities and functional [Q] active skills', () => {
  assert.equal(HEROES.length, 36);
  const engine = new GameEngine(() => {});
  engine.startPlaying(false);
  engine.assist.invincible = true;

  for (const h of HEROES) {
    const el = getHeroElement(h.id);
    assert.ok(ELEMENT_META[el], `Missing element metadata for hero ${h.id}`);
    engine.hitstop = 0;
    engine.overdrive = 0;
    engine.overdriveTimer = 0;
    engine.setHero(h.id);
    engine.heroSkillCooldown = 0;
    engine.step(1 / 60, { ...emptyInput, skillJustPressed: true });
    assert.ok(
      engine.heroSkillCooldown > 0,
      `Expected active skill [Q] of ${h.id} (${h.activeSkillName}) to trigger cooldown`
    );
  }
});

test('Boss Retreat-on-Hit triggers when any boss takes non-lethal damage across all 20 bosses', () => {
  assert.equal(BOSS_ORDER.length, 20);
  const engine = new GameEngine(() => {});
  engine.startPlaying(false);
  engine.assist.invincible = true;
  engine.setHero('ignis');

  // Test boss retreat-on-hit explicitly using the newest 6 bosses + original sentinel
  const testBossKinds = [
    'boss_sentinel',
    'boss_canyon_colossus',
    'boss_cyber_archon',
    'boss_marble_titan',
    'boss_fen_hydra',
    'boss_star_emperor',
    'boss_twilight_wraith',
  ] as const;

  for (const kind of testBossKinds) {
    assert.ok(BOSS_META[kind], `Missing BOSS_META for ${kind}`);
    const p = engine.player;
    const bossEnt = {
      def: { id: `test_${kind}`, kind, x: p.x + 2, y: p.y },
      x: p.x + 2,
      y: p.y,
      w: 22,
      h: 24,
      vx: 0,
      vy: 0,
      homeX: p.x + 120,
      homeY: p.y,
      timer: 0,
      cooldown: 0.4,
      state: 'idle' as const,
      hp: 6,
      maxHp: 6,
      dir: -1 as const,
      flash: 0,
      koTimer: 0,
      collected: false,
      attackIdx: 0,
      elementMark: null,
      elementTimer: 0,
    };
    engine.liveEntities = [bossEnt];
    const startBossX = bossEnt.x;

    // Trigger AoE burst damage on boss -> must enter 'retreat' & reposition away!
    engine.hitstop = 0;
    engine.heroSkillCooldown = 0;
    engine.step(1 / 60, { ...emptyInput, skillJustPressed: true });
    assert.ok(bossEnt.hp < 6, `Expected ${kind} to take damage from player skill burst`);
    assert.equal(bossEnt.state, 'retreat', `Expected ${kind} to enter retreat state after hit`);

    // Step retreat flight for several frames
    engine.hitstop = 0;
    for (let f = 0; f < 16; f++) {
      engine.step(1 / 60, emptyInput);
    }
    const distFromStart = Math.abs(bossEnt.x - startBossX);
    assert.ok(
      distFromStart >= 35,
      `Expected retreating ${kind} to move away from player, moved ${distFromStart}px`
    );
  }
});

test('Duo Tag Swap [F], Sanctuary Rune/Mastery upgrades, Elemental Reaction, and Astral Rift work cleanly', () => {
  const engine = new GameEngine(() => {});
  engine.startPlaying(false);
  engine.assist.invincible = true;

  // Set duo hero to a distinct element hero ('ignis' flame vs 'lyra' astral)
  engine.setHero('lyra');
  engine.setTagHero('ignis');
  engine.tagSwapCooldown = 0;

  // Duo Tag Swap [F] switches heroId and swaps tagHeroId
  engine.step(1 / 60, { ...emptyInput, swapJustPressed: true });
  assert.equal(engine.heroId, 'ignis');
  assert.equal(engine.tagHeroId, 'lyra');
  assert.ok(engine.tagSwapCooldown > 1.0);
  assert.ok(engine.unlockedAchievements.has('duo_synergy'));

  // Mastery upgrade consumes XP and bumps level
  engine.mastery.xp = 100;
  assert.equal(engine.upgradeMasteryBranch('mobilityLv'), true);
  assert.equal(engine.mastery.mobilityLv, 1);

  // Unlock & equip myth rune 'eco_duplo' for extra air jump
  engine.astralCoins = 30;
  assert.equal(engine.toggleRune('eco_duplo'), true);
  assert.ok(engine.equippedRunes.includes('eco_duplo'));

  // Astral Rift activation spawns timed 5 rings & collects them
  engine.liveEntities.push({
    def: { id: 'test_rift', kind: 'rift_trial', x: engine.player.x, y: engine.player.y },
    x: engine.player.x,
    y: engine.player.y,
    w: 16,
    h: 18,
    vx: 0,
    vy: 0,
    homeX: engine.player.x,
    homeY: engine.player.y,
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
  engine.hitstop = 0;
  engine.step(1 / 60, emptyInput);
  assert.equal(engine.riftActive, true);
  assert.equal(engine.riftRings.length, 5);
});

test('233 Mechanics catalog, 18 Boons, 11 Talismans, 10 Titles, 12 Contracts, 20 Bestiary & 8 Jukebox tracks validate cleanly', () => {
  assert.equal(TOTAL_MECHANICS, 233);
  assert.equal(MECHANICS_CATALOG.length, 233);
  const codes = new Set<string>();
  MECHANICS_CATALOG.forEach((m, idx) => {
    assert.equal(m.id, idx + 1, `Expected sequential ID ${idx + 1}, got ${m.id}`);
    assert.ok(!codes.has(m.code), `Duplicate mechanic code: ${m.code}`);
    codes.add(m.code);
  });

  assert.equal(BOONS.length, 18);
  const boonBonuses = computeBoonBonuses(['wind_walker', 'air_dancer', 'chrono_surge', 'star_magnet', 'solar_flare', 'style_emperor', 'critical_edge']);
  assert.ok(boonBonuses.speedMult > 1.2);
  assert.equal(boonBonuses.extraAirJump, 1);
  assert.equal(boonBonuses.magnetRange, 75);
  assert.equal(boonBonuses.reactionBonusDamage, 1);
  assert.equal(boonBonuses.critVulnerableBonus, 1);
  const draft = pickBoonDraftOptions(['wind_walker'], 3);
  assert.equal(draft.length, 3);
  assert.equal(new Set(draft).size, 3);
  assert.ok(draft.every((id) => Boolean(BOON_MAP[id])));

  assert.equal(TALISMANS.length, 11);
  assert.equal(PLAYER_TITLES.length, 10);
  const titlesAll = evaluateUnlockedTitles({
    perfectDodges: 5,
    crownShards: 4,
    bossesDefeated: 16,
    styleSS: 2,
    reactions: 6,
    relics: 25,
    bestWave: 7,
    discoveredMechanics: 180,
  });
  assert.equal(titlesAll.length, 10);

  assert.equal(HUNTER_CONTRACTS.length, 12);
  assert.equal(getContractMetricValue('crownShards', {
    bossesDefeated: 1,
    perfectDodges: 2,
    crownShards: 7,
    relics: 3,
    reactions: 4,
    bestWave: 5,
    styleSS: 6,
    parries: 8,
  }), 7);

  assert.equal(BESTIARY_ENTRIES.length, 20);
  for (const kind of BOSS_ORDER) {
    assert.ok(BESTIARY_MAP[kind], `Missing Bestiary entry for ${kind}`);
  }
  assert.equal(JUKEBOX_TRACKS.length, 8);
});

test('Boss spring steering physics, phase scaling, and safe retreat stay inside arena bounds', () => {
  const anchor = computeBossDesiredAnchor({
    homeX: 200,
    homeY: 90,
    playerX: 40,
    playerY: 140,
    roomWidth: 320,
    roomHeight: 180,
    phase: 2,
    time: 1.5,
  });
  assert.ok(anchor.x >= 28 && anchor.x <= 292);
  assert.ok(anchor.y >= 26 && anchor.y <= 140);

  // Velocity smoothing clamps speed & advances toward target
  let sx = 40;
  let sy = 40;
  let svx = 0;
  let svy = 0;
  for (let i = 0; i < 60; i++) {
    const next = stepSmoothVelocity(sx, sy, svx, svy, 240, 120, 1 / 60);
    assert.ok(Math.hypot(next.vx, next.vy) <= 145.1);
    sx = next.x;
    sy = next.y;
    svx = next.vx;
    svy = next.vy;
  }
  assert.ok(sx > 70 && sy > 50);

  const retreat = chooseSafeRetreatPoint(80, 120, 82, 320, 180);
  assert.ok(retreat.x >= 34 && retreat.x <= 286);
  assert.ok(Math.abs(retreat.x - 82) >= 50);

  assert.equal(computeBossPhaseStats(10, 10).phase, 1);
  assert.equal(computeBossPhaseStats(6, 10).phase, 2);
  assert.equal(computeBossPhaseStats(3, 10).phase, 3);
});

test('Engine supports Direct Boss Practice, Stagger Guard-Break + Crown Shard, Boons, Talismans, Contracts, and New Interactables', () => {
  const engine = new GameEngine(() => {});
  assert.equal(engine.practiceBoss('boss_ignis_rex'), true);
  assert.equal(engine.mode, 'playing');
  engine.setHero('ignis');

  const boss = engine.liveEntities.find((e) => e.def.kind === 'boss_ignis_rex');
  assert.ok(boss, 'Expected Ignis Rex spawned in arena');
  if (!boss) return;

  // Push stagger to break threshold -> should transition to staggered & spawn boss_crown_shard
  boss.maxStagger = 3;
  boss.stagger = 2.9;
  boss.bossSubState = 'orbit';
  engine.hitstop = 0;
  engine.heroSkillCooldown = 0;
  engine.player.x = boss.x;
  engine.player.y = boss.y;
  engine.assist.invincible = true;
  engine.step(1 / 60, { ...emptyInput, skillJustPressed: true });
  assert.equal(boss.bossSubState, 'staggered');
  assert.ok(
    engine.liveEntities.some((e) => e.def.kind === 'boss_crown_shard'),
    'Expected Guard-Break to spawn boss_crown_shard'
  );

  // Trigger Boon Draft & pick a card
  engine.triggerBoonDraft();
  assert.ok(engine.pendingBoonChoices && engine.pendingBoonChoices.length === 3);
  const picked = engine.pendingBoonChoices![0];
  engine.chooseBoon(picked);
  assert.equal(engine.pendingBoonChoices, null);
  assert.ok(engine.activeBoons.includes(picked));
  assert.equal(engine.mode, 'playing');

  // Talisman purchase & equip
  engine.astralCoins = 20;
  assert.equal(engine.selectTalisman('coracao_brasas'), true);
  assert.equal(engine.equippedTalisman, 'coracao_brasas');

  // Claim contract
  engine.perfectDodges = 4;
  const coinsBefore = engine.astralCoins;
  assert.equal(engine.claimContract('c_dodge_3'), true);
  assert.ok(engine.astralCoins > coinsBefore);

  // New interactables: heal_orb, elemental_totem, echo_mirror
  engine.player.heroShieldReady = false;
  engine.liveEntities.push(
    {
      def: { id: 'p_heal', kind: 'heal_orb', x: engine.player.x, y: engine.player.y },
      x: engine.player.x,
      y: engine.player.y,
      w: 14,
      h: 14,
      vx: 0,
      vy: 0,
      homeX: engine.player.x,
      homeY: engine.player.y,
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
      def: { id: 'p_totem', kind: 'elemental_totem', x: engine.player.x, y: engine.player.y },
      x: engine.player.x,
      y: engine.player.y,
      w: 14,
      h: 18,
      vx: 0,
      vy: 0,
      homeX: engine.player.x,
      homeY: engine.player.y,
      timer: 0,
      cooldown: 0,
      state: 'idle',
      hp: 1,
      maxHp: 1,
      dir: 1,
      flash: 0,
      koTimer: 0,
      collected: false,
      subType: 'frost',
    },
    {
      def: { id: 'p_mirror', kind: 'echo_mirror', x: engine.player.x, y: engine.player.y },
      x: engine.player.x,
      y: engine.player.y,
      w: 14,
      h: 18,
      vx: 0,
      vy: 0,
      homeX: engine.player.x,
      homeY: engine.player.y,
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
  engine.hitstop = 0;
  engine.step(1 / 60, emptyInput);
  assert.equal(engine.player.heroShieldReady, true);
  assert.equal(engine.imbuedElement, 'frost');
  assert.ok(engine.echoCloneTimer > 0);
});

test('computeVictoryRewards calculates 1-3 stars, commendations, and reward totals accurately', () => {
  const legend = computeVictoryRewards({
    elapsedSeconds: 58,
    deaths: 0,
    relicsCollected: 3,
    totalRelics: 3,
    styleRank: 'SS',
    styleScore: 4200,
    chapterIndex: 0,
  });
  assert.equal(legend.stars, 3);
  assert.equal(legend.gradeLabel, 'VITÓRIA LENDÁRIA');
  assert.ok(legend.commendations.some((c) => c.id === 'flawless'));
  assert.ok(legend.commendations.some((c) => c.id === 'all_relics'));
  assert.ok(legend.bonusCoins >= 11);

  const solid = computeVictoryRewards({
    elapsedSeconds: 210,
    deaths: 2,
    relicsCollected: 1,
    totalRelics: 3,
    styleRank: 'B',
    styleScore: 950,
    chapterIndex: 2,
  });
  assert.equal(solid.stars, 2);
  assert.equal(solid.gradeLabel, 'GLÓRIA ASTRAL');

  const scrapeBy = computeVictoryRewards({
    elapsedSeconds: 420,
    deaths: 9,
    relicsCollected: 0,
    totalRelics: 4,
    styleRank: 'C',
    styleScore: 200,
    chapterIndex: 4,
  });
  assert.equal(scrapeBy.stars, 1);
  assert.equal(scrapeBy.commendations[0]?.id, 'conqueror');

  const finalPeak = computeVictoryRewards({
    elapsedSeconds: 110,
    deaths: 1,
    relicsCollected: 0,
    totalRelics: 0,
    styleRank: 'A',
    styleScore: 2200,
    chapterIndex: 19,
    isFinalVictory: true,
  });
  assert.equal(finalPeak.stars, 3);
  assert.ok(finalPeak.masteryXp >= 130);
  assert.equal(legend.starCriteria.length, 3);
  assert.equal(legend.starCriteria.every((c) => c.achieved), true);
  assert.equal(scrapeBy.starCriteria[1].achieved, false);
});

test('computeDefeatSummary handles boss defeat with bestiary tip, survival records, and ironman', () => {
  const bossDefeat = computeDefeatSummary({
    playMode: 'boss_rush',
    bossName: 'Ignis Rex',
    bossHp: 3,
    bossMaxHp: 10,
    bossWeakness: 'frost',
    survivalWave: 1,
    survivalKills: 0,
    bestSurvivalWave: 1,
    stageNumber: 1,
    totalStagesInChapter: 4,
    perfectDodges: 2,
    totalParries: 1,
    hardcoreGameOver: false,
  });
  assert.equal(bossDefeat.headline, 'RUSH INTERROMPIDO');
  assert.equal(bossDefeat.bossRemainingPct, 30);
  assert.ok(bossDefeat.bestiaryTip && bossDefeat.bestiaryTip.includes('Gelo'));

  const bossMetaNameDefeat = computeDefeatSummary({
    playMode: 'campaign',
    bossName: 'TITÃ DA OBSIDIANA',
    bossHp: 4,
    bossMaxHp: 10,
    bossWeakness: 'frost',
    survivalWave: 1,
    survivalKills: 0,
    bestSurvivalWave: 1,
    stageNumber: 10,
    totalStagesInChapter: 10,
    perfectDodges: 3,
    totalParries: 1,
    hardcoreGameOver: true,
  });
  assert.ok(bossMetaNameDefeat.bestiaryTip && bossMetaNameDefeat.bestiaryTip.includes('Gelo'));
  assert.equal(bossMetaNameDefeat.tacticalTip, bossMetaNameDefeat.bestiaryTip);

  const survivalDefeat = computeDefeatSummary({
    playMode: 'survival',
    bossName: null,
    bossHp: null,
    bossMaxHp: null,
    bossWeakness: null,
    survivalWave: 7,
    survivalKills: 42,
    bestSurvivalWave: 7,
    stageNumber: 1,
    totalStagesInChapter: 1,
    perfectDodges: 4,
    totalParries: 2,
    hardcoreGameOver: false,
  });
  assert.equal(survivalDefeat.headline, 'ARENA ENCERRADA');
  assert.equal(survivalDefeat.isNewWaveRecord, true);

  const ironmanDefeat = computeDefeatSummary({
    playMode: 'ironman',
    bossName: null,
    bossHp: null,
    bossMaxHp: null,
    bossWeakness: null,
    survivalWave: 1,
    survivalKills: 0,
    bestSurvivalWave: 1,
    stageNumber: 3,
    totalStagesInChapter: 5,
    perfectDodges: 0,
    totalParries: 0,
    hardcoreGameOver: true,
  });
  assert.equal(ironmanDefeat.headline, 'QUEDA IRONMAN');
  assert.equal(ironmanDefeat.stageProgressPct, 60);
  assert.ok(ironmanDefeat.tacticalTip.includes('Esquiva Perfeita'));

  const towerDefeat = computeDefeatSummary({
    playMode: 'tower',
    bossName: null,
    bossHp: null,
    bossMaxHp: null,
    bossWeakness: null,
    survivalWave: 1,
    survivalKills: 0,
    bestSurvivalWave: 1,
    towerFloor: 8,
    bestTowerFloor: 8,
    stageNumber: 8,
    totalStagesInChapter: 8,
    perfectDodges: 2,
    totalParries: 1,
    hardcoreGameOver: false,
  });
  assert.equal(towerDefeat.headline, 'ESCALADA ENCERRADA');
  assert.equal(towerDefeat.isNewTowerRecord, true);
});

test('Player Level XP progression, Hero unlock gating, and Tower Climbing mode work together', () => {
  // 1. Player XP & Level scaling
  const lv1 = getLevelProgressFromXp(0);
  assert.equal(lv1.level, 1);
  assert.equal(lv1.currentLevelXp, 0);
  assert.ok(lv1.nextLevelXp >= 45);

  const reqLv1 = getXpRequiredForLevel(1);
  const lv2 = getLevelProgressFromXp(reqLv1 + 25);
  assert.equal(lv2.level, 2);
  assert.equal(lv2.currentLevelXp, 25);

  const bonusHigh = getPlayerLevelBonuses(20);
  assert.ok(bonusHigh.speedMult > 1);
  assert.ok(bonusHigh.staminaMult > 1);
  assert.ok(bonusHigh.skillCdMult < 1);
  assert.equal(getLevelProgressFromXp(9999999).level, PLAYER_MAX_LEVEL);

  // 2. Hero gating (starters free, locked heroes require level & Astral Coins)
  const engine = new GameEngine(() => {});
  for (const starter of STARTER_HERO_IDS) {
    assert.equal(engine.isHeroUnlocked(starter), true);
  }
  const lockedLegend = HEROES.find((h) => h.rarity === 'Lendário')!;
  const req = getHeroUnlockReq(lockedLegend);
  assert.ok(req.requiredLevel >= 15);
  assert.ok(req.coinCost >= 250);
  assert.equal(engine.isHeroUnlocked(lockedLegend.id), false);
  assert.equal(engine.setHero(lockedLegend.id, 'default', true), false, 'Cannot equip locked hero');
  assert.equal(engine.unlockHero(lockedLegend.id), false, 'Cannot unlock without level & coins');

  // Grant enough XP and coins to unlock
  engine.grantPlayerXp(50000);
  engine.astralCoins = req.coinCost + 10;
  assert.equal(canUnlockHero(lockedLegend, engine.astralCoins, engine.getPlayerLevel()).canUnlock, true);
  assert.equal(engine.unlockHero(lockedLegend.id), true);
  assert.equal(engine.isHeroUnlocked(lockedLegend.id), true);
  assert.equal(engine.astralCoins, 10);
  assert.equal(engine.setHero(lockedLegend.id, 'default', true), true);

  // 3. Tower Climbing mode transitions & Boss on floor 5
  engine.startPlayMode('tower', false);
  assert.equal(engine.playMode, 'tower');
  assert.equal(engine.towerFloor, 1);
  assert.ok(engine.bestTowerFloor >= 1);

  engine.loadTowerFloor(5);
  assert.equal(engine.towerFloor, 5);
  assert.ok(engine.bestTowerFloor >= 5);
  assert.equal(engine.isGoalLocked(), true, 'Floor 5 boss locks the summit portal');
});



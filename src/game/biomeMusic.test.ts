// @ts-nocheck -- imported game code, written for a looser TS config
import test from 'vitest';
import assert from 'node:assert/strict';
import {
  BIOME_MUSIC_SCORES,
  JUKEBOX_TO_BIOME,
  computeNoteSteps,
  midiToFreq,
} from './biomeMusic';
import { BIOME_META } from './worldData';
import { JUKEBOX_TRACKS } from './systems';
import type { BiomeId } from './types';

test('all 20 biomes have unique, melodic, well-formed 32-step musical compositions', () => {
  const biomeIds = Object.keys(BIOME_META) as BiomeId[];
  assert.equal(biomeIds.length, 20, 'expected 20 biomes in BIOME_META');

  const melodySignatures = new Set<string>();

  for (const biome of biomeIds) {
    const score = BIOME_MUSIC_SCORES[biome];
    assert.ok(score, `missing musical score for biome ${biome}`);
    assert.equal(score.biome, biome);
    assert.ok(score.title.length >= 4, `${biome} title too short`);
    assert.ok(score.bpm >= 68 && score.bpm <= 160, `${biome} bpm out of range: ${score.bpm}`);
    assert.ok(score.subdivision === 2 || score.subdivision === 4);
    assert.equal(score.chords.length, 4, `${biome} should have 4 chords`);
    assert.equal(score.melody.length, 32, `${biome} melody should have 32 steps`);
    assert.equal(score.counterArp.length, 32, `${biome} counterArp should have 32 steps`);
    assert.equal(score.bass.length, 32, `${biome} bass should have 32 steps`);
    assert.equal(score.drums.length, 32, `${biome} drums should have 32 steps`);

    const melNotes = score.melody.filter((n): n is number => n !== null);
    assert.ok(melNotes.length >= 12, `${biome} melody has too few notes (${melNotes.length})`);
    assert.ok(new Set(melNotes).size >= 4, `${biome} melody needs >= 4 distinct pitches`);

    for (const midi of [...melNotes, ...score.bass.filter((n): n is number => n !== null)]) {
      assert.ok(midi >= 24 && midi <= 96, `${biome} MIDI note out of range: ${midi}`);
      const f = midiToFreq(midi);
      assert.ok(Number.isFinite(f) && f > 30 && f < 4000, `${biome} invalid freq ${f}`);
    }

    const sig = score.melody.map((n) => (n === null ? '-' : n)).join(',');
    assert.equal(melodySignatures.has(sig), false, `duplicate melody detected on biome ${biome}`);
    melodySignatures.add(sig);
  }
});

test('jukebox tracks map to valid biome scores and computeNoteSteps returns valid legato lengths', () => {
  for (const track of JUKEBOX_TRACKS) {
    const mapped = JUKEBOX_TO_BIOME[track.id];
    assert.ok(mapped, `missing jukebox biome mapping for ${track.id}`);
    assert.ok(BIOME_MUSIC_SCORES[mapped], `missing score for mapped biome ${mapped}`);
  }

  const pattern = [69, null, null, 72, null];
  assert.equal(computeNoteSteps(pattern, 0, 4), 3);
  assert.equal(computeNoteSteps(pattern, 3, 4), 2);
});

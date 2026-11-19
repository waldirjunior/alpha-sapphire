import { describe, expect, it } from 'vitest';
import { classifyBattleMusic, leveledUpDuring, resolveBattleMusic, resolveBattleSfx, resolveCurrentMusic } from './battleAudio';

describe('battle music adapter (P-008)', () => {
  it('classifies wild, trainer, rival and gym battles', () => {
    expect(classifyBattleMusic({ isTrainer: false })).toBe('wild');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Youngster Calvin' })).toBe('trainer');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Rival May' })).toBe('rival');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Gym Leader Roxanne' })).toBe('gym');
  });

  it('plays the battle theme while ongoing and the fanfare on victory', () => {
    expect(resolveBattleMusic({ status: 'ongoing', isTrainer: false })).toBe('bgm_sg_vs_norapoke_sg');
    expect(resolveBattleMusic({ status: 'ongoing', isTrainer: true, trainerName: 'Youngster Calvin' })).toBe('bgm_sg_vs_trainer_sg');
    expect(resolveBattleMusic({ status: 'victory', isTrainer: false })).toBe('bgm_sg_win1');
    expect(resolveBattleMusic({ status: 'victory', isTrainer: true, trainerName: 'Rival May' })).toBe('bgm_sg_win2');
  });

  it('returns to the zone track after fleeing, catching, defeat or closing the battle', () => {
    for (const status of ['fled', 'caught', 'defeat'] as const) {
      expect(resolveCurrentMusic({ status, isTrainer: false }, 'bgm_sg_r_a')).toBe('bgm_sg_r_a');
    }
    expect(resolveCurrentMusic(null, 'bgm_sg_r_a')).toBe('bgm_sg_r_a');
    expect(resolveCurrentMusic({ status: 'ongoing' }, null)).toBe('bgm_sg_vs_norapoke_sg');
    expect(resolveCurrentMusic(null, null)).toBeNull();
  });

  it('detects level-ups between party snapshots for the jingle', () => {
    expect(leveledUpDuring([{ level: 5 }, { level: 3 }], [{ level: 5 }, { level: 4 }])).toBe(true);
    expect(leveledUpDuring([{ level: 5 }], [{ level: 5 }, { level: 2 }])).toBe(false);
  });

  it('selects battle sound cues deterministically from resolved battle events', () => {
    expect(resolveBattleSfx({ type: 'move', side: 'player', category: 'physical' })).toBeNull();
    expect(resolveBattleSfx({ type: 'damage', side: 'enemy' })).toBe('battle-hit');
    expect(resolveBattleSfx({ type: 'faint', side: 'enemy' })).toBe('faint');
    expect(resolveBattleSfx({ type: 'pokeball', captured: false })).toBe('pokeball-throw');
    expect(resolveBattleSfx({ type: 'pokeball', captured: true })).toBe('pokeball-capture');
  });

});

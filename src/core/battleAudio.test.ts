import { describe, expect, it } from 'vitest';
import {
  BCSAR_SFX_REFERENCES,
  classifyBattleMusic,
  leveledUpDuring,
  resolveBattleMusic,
  resolveBattleSfx,
  resolveBcsarSfxReference,
  resolveCurrentMusic,
  resolveZoneSfx,
} from './battleAudio';

describe('battle music adapter (P-008)', () => {
  it('classifies the eight supported battle contexts', () => {
    expect(classifyBattleMusic({ isTrainer: false })).toBe('wild');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Youngster Calvin' })).toBe('trainer');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Rival May' })).toBe('rival');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Wally' })).toBe('rival');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Gym Leader Roxanne' })).toBe('gym_leader');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Team Aqua Grunt' })).toBe('aqua_magma');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Elite Four Phoebe' })).toBe('elite_four');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Champion Steven' })).toBe('champion');
    expect(classifyBattleMusic({ isTrainer: true, trainerName: 'Steven' })).toBe('champion');
    expect(classifyBattleMusic({ isTrainer: false, context: 'legendary' })).toBe('legendary');
  });

  it('maps each battle context to its BGM and victory fanfare', () => {
    const cases = [
      ['wild', 'bgm_sg_vs_norapoke_sg', 'bgm_sg_win1'],
      ['trainer', 'bgm_sg_vs_trainer_sg', 'bgm_sg_win2'],
      ['rival', 'bgm_sg_vs_rival_sg', 'bgm_sg_win2'],
      ['gym_leader', 'bgm_sg_vs_gymleader_sg', 'bgm_sg_win3'],
      ['aqua_magma', 'bgm_sg_vs_aqua_magma', 'bgm_sg_win2'],
      ['elite_four', 'bgm_sg_vs_shitenno_sg', 'bgm_sg_win3'],
      ['champion', 'bgm_sg_vs_champ_sg', 'bgm_sg_win3'],
      ['legendary', 'bgm_sg_vs_legend_sg', 'bgm_sg_win1'],
    ] as const;
    for (const [context, battleTrack, victoryTrack] of cases) {
      expect(resolveBattleMusic({ status: 'ongoing', context })).toBe(battleTrack);
      expect(resolveBattleMusic({ status: 'victory', context })).toBe(victoryTrack);
    }
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

  it('maps the observed early-game SEPlay IDs to procedural cues', () => {
    expect(resolveZoneSfx(0x060000)).toBe('dialogue-confirm');
    expect(resolveZoneSfx(0x060061)).toBe('menu-select');
    expect(resolveZoneSfx(0x0a00dd)).toBe('zone-warp');
    expect(resolveZoneSfx(0x0a0240)).toBe('battle-hit');
    expect(resolveZoneSfx(123456)).toBeNull();
  });

  it('resolves cue aliases to labeled BCSAR references without mapping battle-hit', () => {
    expect(resolveBcsarSfxReference('dialogue-confirm')).toMatchObject({ index: 261, label: 'SEQ_SE_MESSAGE' });
    expect(resolveBcsarSfxReference('menu-open')).toMatchObject({ index: 262, label: 'SEQ_SE_DECIDE1' });
    expect(resolveBcsarSfxReference('menu-select')).toMatchObject({ index: 265, label: 'SEQ_SE_SELECT1' });
    expect(resolveBcsarSfxReference('pokeball-capture')).toMatchObject({ index: 270, label: 'SEQ_SE_CATCH' });
    expect(resolveBcsarSfxReference('heal-chime')).toMatchObject({ index: 343, label: 'SEQ_SE_RECOVERY' });
    expect(resolveBcsarSfxReference('wall-bump')).toMatchObject({ index: 413, label: 'SEQ_SE_FLD_WALL_HIT' });
    expect(resolveBcsarSfxReference('zone-warp')).toMatchObject({ index: 1481, label: 'SEQ_SE_KW_DOOROPEN' });
    expect(resolveBcsarSfxReference('door-close')).toMatchObject({ index: 1480, label: 'SEQ_SE_KW_DOORCLOSE' });
    expect(resolveBcsarSfxReference('battle-hit')).toBeUndefined();
    expect(BCSAR_SFX_REFERENCES).toContainEqual({ index: 1480, label: 'SEQ_SE_KW_DOORCLOSE' });
  });

});

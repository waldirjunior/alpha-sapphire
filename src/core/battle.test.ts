import { describe, expect, it } from 'vitest';
import { ROUTE_101_ENCOUNTERS } from '../data/pokemon/route101';
import { MOVES, SPECIES } from '../data/pokemon/species';
import {
  calculateDamage,
  createPokemonInstance,
  executeBattleTurn,
  getTypeEffectiveness,
  rollWildEncounter,
  runFromBattle,
  startWildBattle,
} from './battle';

describe('battle engine', () => {
  it('computes Gen VI type effectiveness and STAB damage deterministically', () => {
    expect(getTypeEffectiveness('fire', ['bug'])).toBe(2);
    expect(getTypeEffectiveness('water', ['grass'])).toBe(0.5);

    const torchic = createPokemonInstance(SPECIES.torchic, 5);
    const wurmple = createPokemonInstance(SPECIES.wurmple, 3);
    const dmg = calculateDamage(torchic, wurmple, MOVES.ember, () => 1);
    expect(dmg).toBeGreaterThan(10);
  });

  it('rolls wild encounters deterministically from weighted table', () => {
    const first = rollWildEncounter(ROUTE_101_ENCOUNTERS, () => 0.05, () => 0.1);
    expect(first).toEqual({ speciesId: 'poochyena', level: 2 });

    const last = rollWildEncounter(ROUTE_101_ENCOUNTERS, () => 0.05, () => 0.95);
    expect(last).toEqual({ speciesId: 'wurmple', level: 3 });

    const none = rollWildEncounter(ROUTE_101_ENCOUNTERS, () => 0.9, () => 0.1);
    expect(none).toBeNull();
  });

  it('executes turn order, reduces HP, and ends in victory or flee', () => {
    const starter = createPokemonInstance(SPECIES.torchic, 5);
    const wild = createPokemonInstance(SPECIES.wurmple, 2);
    let battle = startWildBattle(starter, wild);

    expect(battle.status).toBe('ongoing');
    battle = executeBattleTurn(battle, 1, () => 1); // Ember
    expect(['ongoing', 'victory']).toContain(battle.status);
    expect(battle.enemy.currentHp).toBeLessThan(battle.enemy.maxHp);

    // Finish battle if still ongoing
    if (battle.status === 'ongoing') {
      battle = executeBattleTurn(battle, 1, () => 1);
    }
    expect(battle.status).toBe('victory');

    // Run from battle
    const fresh = startWildBattle(starter, createPokemonInstance(SPECIES.poochyena, 2));
    const fled = runFromBattle(fresh);
    expect(fled.status).toBe('fled');
  });
});

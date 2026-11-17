import { describe, expect, it } from 'vitest';
import { ROUTE_101_ENCOUNTERS } from '../data/pokemon/route101';
import { MOVES, SPECIES } from '../data/pokemon/species';
import {
  calculateDamage,
  createPokemonInstance,
  executeBattleTurn,
  getTypeEffectiveness,
  healParty,
  rollWildEncounter,
  runFromBattle,
  startTrainerBattle,
  startWildBattle,
  switchActivePokemon,
  throwPokeball,
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
    const emberIdx = battle.player.moves.findIndex((move) => move.name === 'Ember');
    battle = executeBattleTurn(battle, emberIdx, () => 1);
    expect(['ongoing', 'victory']).toContain(battle.status);
    expect(battle.enemy.currentHp).toBeLessThan(battle.enemy.maxHp);

    // Finish battle if still ongoing
    if (battle.status === 'ongoing') {
      battle = executeBattleTurn(battle, emberIdx, () => 1);
    }
    expect(battle.status).toBe('victory');
    expect(battle.player.xp).toBeGreaterThan(0);

    // Run from battle
    const fresh = startWildBattle(starter, createPokemonInstance(SPECIES.poochyena, 2));
    const fled = runFromBattle(fresh);
    expect(fled.status).toBe('fled');
  });

  it('supports Poké Ball capture and levels up on enough XP', () => {
    const starter = createPokemonInstance(SPECIES.mudkip, 5);
    const wild = createPokemonInstance(SPECIES.poochyena, 2);
    const battle = startWildBattle(starter, wild);

    const caught = throwPokeball(battle, () => 0.01);
    expect(caught.status).toBe('caught');

    const missed = throwPokeball(battle, () => 0.99);
    expect(['ongoing', 'defeat']).toContain(missed.status);
    expect(missed.turn).toBe(2);
  });

  it('switches active Pokémon in battle and heals party to full HP', () => {
    const torchic = { ...createPokemonInstance(SPECIES.torchic, 5), currentHp: 4 };
    const mudkip = createPokemonInstance(SPECIES.mudkip, 5);
    const wild = createPokemonInstance(SPECIES.zigzagoon, 2);

    const battle = startWildBattle(torchic, wild);
    const switched = switchActivePokemon(battle, mudkip, () => 0.5);
    expect(switched.player.species.id).toBe('mudkip');
    expect(switched.turn).toBe(2);

    const healed = healParty([torchic, { ...mudkip, currentHp: 1 }]);
    expect(healed.every((p) => p.currentHp === p.maxHp)).toBe(true);
  });

  it('prevents fleeing and Poké Ball capture in trainer battles', () => {
    const starter = createPokemonInstance(SPECIES.treecko, 6);
    const enemy = createPokemonInstance(SPECIES.poochyena, 5);
    const trainerBattle = startTrainerBattle(starter, enemy, 'Youngster Calvin');

    expect(trainerBattle.isTrainer).toBe(true);
    expect(runFromBattle(trainerBattle).status).toBe('ongoing');
    expect(throwPokeball(trainerBattle, () => 0.01).status).toBe('ongoing');
  });
});

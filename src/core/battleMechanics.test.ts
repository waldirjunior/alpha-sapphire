import { describe, expect, it } from 'vitest';
import { createPokemonInstance, executeBattleTurn, healParty, startWildBattle, type PokemonInstance } from './battle';
import { orderActions, resolveTurn, effectiveSpeed } from './battleTurn';
import { calculateDamage, rollHitCount } from './damage';
import { getMoveByName, getSpeciesById } from './dex';
import { executeMove, rollAccuracy, spendPp } from './moveExecution';
import { toBattleMove } from './battlePokemon';
import { accuracyStageMultiplier, statStageMultiplier } from './statStages';
import { applyResidualDamage, checkCanAct, tryInflictStatus } from './statusConditions';

const always = (value: number) => () => value;
const move = (name: string) => toBattleMove(getMoveByName(name));
const moveIds = (...names: string[]) => names.map((name) => getMoveByName(name).id);

function pokemon(id: string, level: number, ...moves: string[]): PokemonInstance {
  return createPokemonInstance(getSpeciesById(id), level, moveIds(...moves));
}

describe('PP', () => {
  it('starts at ROM PP and decrements by one per use', () => {
    const battle = startWildBattle(pokemon('torchic', 5, 'Scratch'), pokemon('wurmple', 50, 'String Shot'));
    expect(battle.player.moves[0]).toMatchObject({ currentPp: 35, maxPp: 35 });
    const next = executeBattleTurn(battle, 0, always(0.5));
    expect(next.player.moves[0]?.currentPp).toBe(34);
  });

  it('spends an extra PP against a Pressure holder only for foe-targeting moves', () => {
    const user = pokemon('torchic', 5, 'Scratch', 'Swords Dance');
    const pressure = { ...pokemon('dusclops', 30, 'Astonish'), ability: 'Pressure' };
    expect(spendPp(user, 0, pressure).moves[0]?.currentPp).toBe(33);
    expect(spendPp(user, 1, pressure).moves[1]?.currentPp).toBe(19);
  });

  it('refuses a move with 0 PP without advancing the turn', () => {
    const base = pokemon('torchic', 5, 'Scratch', 'Ember');
    const drained = { ...base, moves: base.moves.map((slot, idx) => (idx === 0 ? { ...slot, currentPp: 0 } : slot)) };
    const battle = startWildBattle(drained, pokemon('wurmple', 3, 'Tackle'));
    const next = executeBattleTurn(battle, 0, always(0.5));
    expect(next.turn).toBe(battle.turn);
    expect(next.log.at(-1)).toBe('Não há PP restante para Scratch!');
  });

  it('falls back to Struggle with 1/4 max HP recoil when every move is out of PP', () => {
    const base = pokemon('torchic', 20, 'Scratch');
    const empty = { ...base, moves: base.moves.map((slot) => ({ ...slot, currentPp: 0 })) };
    const battle = startWildBattle(empty, pokemon('zigzagoon', 20, 'Growl'));
    const next = executeBattleTurn(battle, 0, always(0.5));
    expect(next.log).toContain('Torchic não tem mais PP!');
    expect(next.player.currentHp).toBe(empty.maxHp - Math.floor(empty.maxHp / 4));
  });

  it('restores PP, HP and status at the Pokémon Center', () => {
    const base = pokemon('torchic', 5, 'Scratch');
    const worn = { ...base, currentHp: 1, status: { kind: 'burn' as const, counter: 0 }, moves: [{ ...base.moves[0]!, currentPp: 0 }] };
    const [healed] = healParty([worn]);
    expect(healed).toMatchObject({ currentHp: base.maxHp, status: null });
    expect(healed?.moves[0]?.currentPp).toBe(35);
  });
});

describe('accuracy', () => {
  const user = pokemon('torchic', 5, 'Scratch');
  const target = pokemon('wurmple', 5, 'Tackle');

  it('applies Gen VI combined accuracy/evasion stages', () => {
    expect(accuracyStageMultiplier(0, 0)).toBe(1);
    expect(accuracyStageMultiplier(1, 0)).toBeCloseTo(4 / 3);
    expect(accuracyStageMultiplier(0, 6)).toBeCloseTo(3 / 9);
    expect(accuracyStageMultiplier(6, -6)).toBe(3);
  });

  it('misses when the roll exceeds accuracy × stage multiplier', () => {
    const sleepPowder = move('Sleep Powder');
    expect(rollAccuracy(user, target, sleepPowder, always(0.74))).toBe(true);
    expect(rollAccuracy(user, target, sleepPowder, always(0.75))).toBe(false);
    const evasive = { ...target, stages: { ...target.stages, evasion: 1 } };
    expect(rollAccuracy(user, evasive, move('Scratch'), always(0.76))).toBe(false);
  });

  it('never misses with accuracy 101 even against +6 evasion', () => {
    const untouchable = { ...target, stages: { ...target.stages, evasion: 6 } };
    expect(rollAccuracy(user, untouchable, move('Disarming Voice'), always(0.999))).toBe(true);
  });

  it('logs a miss and keeps the target intact', () => {
    const outcome = executeMove(user, target, move('Take Down'), always(0.9));
    expect(outcome.target.currentHp).toBe(target.currentHp);
    expect(outcome.messages).toEqual(['Torchic usou Take Down, mas errou!']);
  });
});

describe('turn order', () => {
  it('lets higher priority move first regardless of speed', () => {
    const slow = pokemon('zigzagoon', 5, 'Quick Attack');
    const fast = { ...pokemon('torchic', 5, 'Scratch'), speed: 99 };
    const state = startWildBattle(slow, fast);
    const [first] = orderActions(state, { side: 'player', moveIndex: 0 }, { side: 'enemy', moveIndex: 0 }, always(0.9));
    expect(first.side).toBe('player');
  });

  it('breaks speed ties with the injected RNG', () => {
    const state = startWildBattle(pokemon('torchic', 5, 'Scratch'), pokemon('torchic', 5, 'Scratch'));
    const actions = [{ side: 'player' as const, moveIndex: 0 }, { side: 'enemy' as const, moveIndex: 0 }] as const;
    expect(orderActions(state, actions[0], actions[1], always(0.1))[0].side).toBe('player');
    expect(orderActions(state, actions[0], actions[1], always(0.9))[0].side).toBe('enemy');
  });

  it('scales speed by stages and quarters it under paralysis', () => {
    const base = { ...pokemon('torchic', 5, 'Scratch'), speed: 40 };
    expect(effectiveSpeed({ ...base, stages: { ...base.stages, spe: 2 } })).toBe(80);
    expect(effectiveSpeed({ ...base, status: { kind: 'paralysis', counter: 0 } })).toBe(10);
  });
});

describe('status conditions', () => {
  const thunderWave = move('Thunder Wave');

  it('inflicts paralysis but respects Electric immunity and existing status', () => {
    const target = pokemon('zigzagoon', 5, 'Tackle');
    expect(tryInflictStatus(target, 'paralysis', thunderWave, always(0)).target.status?.kind).toBe('paralysis');
    expect(tryInflictStatus(pokemon('pikachu', 5, 'Thunder Shock'), 'paralysis', thunderWave, always(0)).message).toBeNull();
    const burned = { ...target, status: { kind: 'burn' as const, counter: 0 } };
    expect(tryInflictStatus(burned, 'paralysis', thunderWave, always(0)).target.status?.kind).toBe('burn');
  });

  it('sleeps for the ROM turn range and wakes up acting', () => {
    const user = pokemon('zigzagoon', 5, 'Tackle');
    const slept = executeMove(user, pokemon('torchic', 5, 'Scratch'), move('Sleep Powder'), always(0)).target;
    expect(slept.status).toEqual({ kind: 'sleep', counter: 2 });
    const first = checkCanAct(slept, always(0));
    expect(first.canAct).toBe(false);
    const second = checkCanAct(first.pokemon, always(0));
    expect(second).toMatchObject({ canAct: true, message: 'Torchic acordou!' });
    expect(second.pokemon.status).toBeNull();
  });

  it('thaws 20% of the time and fully paralyzes 25% of the time', () => {
    const frozen = { ...pokemon('torchic', 5, 'Scratch'), status: { kind: 'freeze' as const, counter: 0 } };
    expect(checkCanAct(frozen, always(0.19)).canAct).toBe(true);
    expect(checkCanAct(frozen, always(0.2)).canAct).toBe(false);
    const paralyzed = { ...frozen, status: { kind: 'paralysis' as const, counter: 0 } };
    expect(checkCanAct(paralyzed, always(0.24)).canAct).toBe(false);
    expect(checkCanAct(paralyzed, always(0.25)).canAct).toBe(true);
  });

  it('deals 1/8 burn damage, halves physical damage and escalates toxic n/16', () => {
    const base = { ...pokemon('mudkip', 50, 'Tackle'), maxHp: 160, currentHp: 160 };
    const burned = { ...base, status: { kind: 'burn' as const, counter: 0 } };
    expect(applyResidualDamage(burned).pokemon.currentHp).toBe(140);
    const target = pokemon('zigzagoon', 50, 'Tackle');
    expect(calculateDamage(burned, target, move('Tackle'), always(1))).toBeLessThan(calculateDamage(base, target, move('Tackle'), always(1)));
    const toxic = executeMove(target, base, move('Toxic'), always(0)).target;
    const turn1 = applyResidualDamage(toxic).pokemon;
    const turn2 = applyResidualDamage(turn1).pokemon;
    expect([160 - turn1.currentHp, turn1.currentHp - turn2.currentHp]).toEqual([10, 20]);
  });

  it('applies secondary burn from Ember only when the chance roll succeeds', () => {
    const user = pokemon('torchic', 5, 'Ember');
    const target = pokemon('zigzagoon', 20, 'Tackle');
    expect(executeMove(user, target, move('Ember'), always(0.05)).target.status?.kind).toBe('burn');
    expect(executeMove(user, target, move('Ember'), always(0.5)).target.status).toBeNull();
  });
});

describe('stat stages and HP effects', () => {
  const user = pokemon('torchic', 20, 'Scratch');
  const target = pokemon('zigzagoon', 20, 'Tackle');

  it('lowers the target with Growl and raises the user with Swords Dance up to +6', () => {
    expect(executeMove(user, target, move('Growl'), always(0)).target.stages.atk).toBe(-1);
    let boosted = user;
    for (let i = 0; i < 4; i += 1) boosted = executeMove(boosted, target, move('Swords Dance'), always(0)).user;
    expect(boosted.stages.atk).toBe(6);
    expect(executeMove(boosted, target, move('Swords Dance'), always(0)).messages).toContain('Ataque de Torchic não pode subir mais!');
    expect(statStageMultiplier(-1)).toBeCloseTo(2 / 3);
  });

  it('heals 50% with Recover and drains 50% with Absorb', () => {
    const hurt = { ...pokemon('treecko', 20, 'Absorb'), currentHp: 10 };
    expect(executeMove(hurt, target, move('Recover'), always(0)).user.currentHp).toBe(10 + Math.floor(hurt.maxHp / 2));
    const absorb = executeMove(hurt, target, move('Absorb'), always(1));
    const dealt = target.currentHp - absorb.target.currentHp;
    expect(absorb.user.currentHp).toBe(10 + Math.max(1, Math.floor(dealt / 2)));
  });

  it('takes 1/4 recoil of the damage dealt with Take Down', () => {
    const outcome = executeMove(user, target, move('Take Down'), always(0));
    const dealt = target.currentHp - outcome.target.currentHp;
    expect(user.currentHp - outcome.user.currentHp).toBe(Math.max(1, Math.floor(dealt / 4)));
  });

  it('rolls 2–5 hits with Gen V+ weights and fixed counts for Double Kick', () => {
    expect([0, 0.4, 0.8, 0.9].map((roll) => rollHitCount(move('Fury Attack'), always(roll)))).toEqual([2, 3, 4, 5]);
    expect(rollHitCount(move('Double Kick'), always(0.9))).toBe(2);
  });

  it('flinches a slower foe with Fake Out', () => {
    const fast = { ...pokemon('zigzagoon', 20, 'Fake Out'), speed: 99 };
    const slow = pokemon('torchic', 20, 'Scratch');
    const next = resolveTurn(startWildBattle(fast, slow), { side: 'player', moveIndex: 0 }, always(0));
    expect(next.log).toContain('Torchic recuou e não pôde agir!');
    expect(next.player.currentHp).toBe(fast.currentHp);
  });
});

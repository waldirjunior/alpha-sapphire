import { describe, expect, it } from 'vitest';
import {
  createPokemonInstance,
  executeBattleTurn,
  resolvePendingMove,
  startTrainerBattle,
  startWildBattle,
  switchActivePokemon,
  type PokemonInstance,
} from './battle';
import { scoreMove, selectTrainerMoveIndex, selectWildMoveIndex } from './battleAi';
import { toBattleMove } from './battlePokemon';
import { calculateDamage, rollCritical } from './damage';
import { getMoveByName, getSpeciesById } from './dex';
import { expYield, levelForTotalExp, totalExpForLevel } from './experience';
import { gainExperience, replaceMove } from './levelUp';

const always = (value: number) => () => value;
const move = (name: string) => toBattleMove(getMoveByName(name));
const moveIds = (...names: string[]) => names.map((name) => getMoveByName(name).id);

function pokemon(id: string, level: number, ...moves: string[]): PokemonInstance {
  return createPokemonInstance(getSpeciesById(id), level, moveIds(...moves));
}

describe('critical hits (Gen VI)', () => {
  const target = pokemon('zigzagoon', 20, 'Tackle');

  it('uses 1/16 at stage 0, 1/8 for high-crit moves and always for stage 3+', () => {
    expect(rollCritical(target, move('Tackle'), always(0.06))).toBe(true);
    expect(rollCritical(target, move('Tackle'), always(0.07))).toBe(false);
    expect(rollCritical(target, move('Slash'), always(0.12))).toBe(true);
    expect(rollCritical(target, move('Slash'), always(0.13))).toBe(false);
    expect(rollCritical(target, move('Frost Breath'), always(0.99))).toBe(true);
  });

  it('is blocked by Battle Armor / Shell Armor', () => {
    const armored = { ...pokemon('kabuto', 20, 'Scratch'), ability: 'Battle Armor' };
    expect(rollCritical(armored, move('Frost Breath'), always(0))).toBe(false);
  });

  it('multiplies by 1.5 and ignores the defender’s positive defense stages', () => {
    const user = pokemon('mudkip', 50, 'Tackle');
    const tackle = move('Tackle');
    const normal = calculateDamage(user, target, tackle, always(1));
    const crit = calculateDamage(user, target, tackle, always(1), { critical: true });
    expect(crit).toBeGreaterThanOrEqual(Math.floor(normal * 1.5) - 1);
    const walled = { ...target, stages: { ...target.stages, def: 6 } };
    expect(calculateDamage(user, walled, tackle, always(1), { critical: true })).toBe(crit);
    expect(calculateDamage(user, walled, tackle, always(1))).toBeLessThan(normal);
  });
});

describe('experience curves and yield', () => {
  it('matches Gen VI totals for each growth rate', () => {
    expect(totalExpForLevel('fast', 100)).toBe(800000);
    expect(totalExpForLevel('medium_fast', 100)).toBe(1000000);
    expect(totalExpForLevel('medium_slow', 100)).toBe(1059860);
    expect(totalExpForLevel('slow', 100)).toBe(1250000);
    expect(totalExpForLevel('erratic', 100)).toBe(600000);
    expect(totalExpForLevel('fluctuating', 100)).toBe(1640000);
    expect(totalExpForLevel('medium_slow', 5)).toBe(135);
    expect(totalExpForLevel('medium_slow', 1)).toBe(0);
    expect(levelForTotalExp('medium_slow', 178)).toBe(5);
    expect(levelForTotalExp('medium_slow', 179)).toBe(6);
  });

  it('uses the Gen VI flat formula with trainer, Lucky Egg and Exp. Share factors', () => {
    const poochyena = getSpeciesById('poochyena');
    const base = { isTrainerBattle: false, participated: true, holdsLuckyEgg: false };
    expect(expYield(poochyena, 5, base)).toBe(40);
    expect(expYield(poochyena, 5, { ...base, isTrainerBattle: true })).toBe(60);
    expect(expYield(poochyena, 5, { ...base, holdsLuckyEgg: true })).toBe(60);
    expect(expYield(poochyena, 5, { ...base, participated: false })).toBe(20);
  });

  it('starts instances at the curve floor for their level', () => {
    const treecko = pokemon('treecko', 5, 'Pound');
    expect(treecko).toMatchObject({ totalExp: 135, xp: 0, nextLevelXp: 179 - 135 });
  });
});

describe('level up and move learning', () => {
  it('raises stats, keeps damage taken and learns the level-up move into a free slot', () => {
    const treecko = { ...pokemon('treecko', 8, 'Pound', 'Leer', 'Absorb'), currentHp: 10 };
    const needed = totalExpForLevel('medium_slow', 9) - treecko.totalExp;
    const result = gainExperience(treecko, needed);
    expect(result.levelsGained).toEqual([9]);
    expect(result.pokemon.level).toBe(9);
    expect(result.pokemon.currentHp).toBe(10 + (result.pokemon.maxHp - treecko.maxHp));
    expect(result.learnedMoves).toEqual(moveIds('Quick Attack'));
    expect(result.messages).toContain('Treecko aprendeu Quick Attack!');
  });

  it('queues the move when four are already known and lets the player replace a slot', () => {
    const full = pokemon('treecko', 8, 'Pound', 'Leer', 'Absorb', 'Tackle');
    const result = gainExperience(full, totalExpForLevel('medium_slow', 9) - full.totalExp);
    expect(result.pendingMoves).toEqual(moveIds('Quick Attack'));
    expect(result.pokemon.moves).toHaveLength(4);
    expect(replaceMove(result.pokemon, 3, getMoveByName('Quick Attack').id).moves[3]?.name).toBe('Quick Attack');
  });

  it('caps experience at level 100', () => {
    const maxed = gainExperience(pokemon('treecko', 99, 'Pound'), 10_000_000).pokemon;
    expect(maxed).toMatchObject({ level: 100, totalExp: 1059860, nextLevelXp: 0 });
  });
});

describe('multi-Pokémon trainer battles', () => {
  const strong = () => pokemon('mudkip', 60, 'Water Gun');

  it('sends the next trainer Pokémon after a faint and wins only when the team is out', () => {
    const team = [pokemon('poochyena', 3, 'Tackle'), pokemon('zigzagoon', 3, 'Tackle')];
    let battle = startTrainerBattle([strong()], team, 'Youngster Calvin');
    battle = executeBattleTurn(battle, 0, always(0.5));
    expect(battle.status).toBe('ongoing');
    expect(battle.enemyActive).toBe(1);
    expect(battle.log).toContain('Youngster Calvin enviou Zigzagoon (Lv.3)!');
    battle = executeBattleTurn(battle, 0, always(0.5));
    expect(battle.status).toBe('victory');
    expect(battle.enemyParty.every((member) => member.currentHp === 0)).toBe(true);
  });

  it('forces a free switch after the active Pokémon faints and loses only with no one left', () => {
    const weak = [pokemon('torchic', 2, 'Scratch'), pokemon('treecko', 2, 'Pound')];
    let battle = startTrainerBattle(weak, [pokemon('poochyena', 60, 'Bite')], 'Grunt');
    battle = executeBattleTurn(battle, 0, always(0.5));
    expect(battle.pendingSwitch).toBe(true);
    expect(battle.status).toBe('ongoing');
    expect(executeBattleTurn(battle, 0, always(0.5)).log.at(-1)).toBe('Escolha um Pokémon para entrar antes de atacar!');
    const switched = switchActivePokemon(battle, 1, always(0.5));
    expect(switched).toMatchObject({ pendingSwitch: false, playerActive: 1, turn: battle.turn });
    expect(switched.player.currentHp).toBe(switched.player.maxHp);
    expect(executeBattleTurn(switched, 0, always(0.5)).status).toBe('defeat');
  });

  it('keeps playerParty in sync and gives every Gen VI participant the full XP (A-014)', () => {
    const lead = pokemon('treecko', 30, 'Pound');
    const bench = pokemon('torchic', 30, 'Scratch');
    let battle = startWildBattle([lead, bench], pokemon('wurmple', 2, 'String Shot'));
    battle = switchActivePokemon(battle, 1, always(0.5));
    expect(battle.participants).toEqual([0, 1]);
    battle = executeBattleTurn(battle, 0, always(0.5));
    expect(battle.status).toBe('victory');
    const share = expYield(getSpeciesById('wurmple'), 2, { isTrainerBattle: false, participated: true, holdsLuckyEgg: false });
    expect(battle.playerParty[0]?.totalExp).toBe(lead.totalExp + share);
    expect(battle.playerParty[1]?.totalExp).toBe(bench.totalExp + share);
    expect(battle.player).toBe(battle.playerParty[battle.playerActive]);
  });

  it('records pending moves learned after battle XP and resolves them', () => {
    const almost = pokemon('treecko', 8, 'Pound', 'Leer', 'Absorb', 'Tackle');
    const ready = { ...almost, totalExp: totalExpForLevel('medium_slow', 9) - 1 };
    const fragile = { ...pokemon('wurmple', 2, 'String Shot'), currentHp: 1 };
    let battle = startWildBattle(ready, fragile);
    battle = executeBattleTurn(battle, 0, always(0.5));
    expect(battle.status).toBe('victory');
    expect(battle.pendingMoves).toEqual([{ partyIndex: 0, moveId: getMoveByName('Quick Attack').id }]);
    const resolved = resolvePendingMove(battle, 0);
    expect(resolved.player.moves[0]?.name).toBe('Quick Attack');
    expect(resolved.pendingMoves).toEqual([]);
  });
});

describe('enemy move selection AI', () => {
  it('trainer AI picks the highest expected damage, preferring super-effective moves', () => {
    const user = pokemon('lotad', 20, 'Absorb', 'Water Gun', 'Growl');
    const torchic = pokemon('torchic', 20, 'Scratch');
    const mudkip = pokemon('mudkip', 20, 'Tackle');
    expect(selectTrainerMoveIndex(user, torchic, always(0))).toBe(1);
    expect(selectTrainerMoveIndex(user, mudkip, always(0))).toBe(0);
    expect(scoreMove(user, torchic, move('Growl'))).toBeLessThan(scoreMove(user, torchic, move('Water Gun')));
  });

  it('trainer AI values status only while the target is healthy and breaks ties with RNG', () => {
    const user = pokemon('pikachu', 20, 'Thunder Wave', 'Growl');
    const target = pokemon('zigzagoon', 20, 'Tackle');
    expect(selectTrainerMoveIndex(user, target, always(0))).toBe(0);
    const paralyzed = { ...target, status: { kind: 'paralysis' as const, counter: 0 } };
    expect(selectTrainerMoveIndex(user, paralyzed, always(0))).toBe(1);
    const twins = pokemon('zigzagoon', 20, 'Tackle', 'Tackle');
    expect(selectTrainerMoveIndex(twins, target, always(0))).toBe(0);
    expect(selectTrainerMoveIndex(twins, target, always(0.9))).toBe(1);
  });

  it('wild AI picks uniformly among moves with PP', () => {
    const wild = pokemon('zigzagoon', 5, 'Tackle', 'Growl');
    const noTackle = { ...wild, moves: wild.moves.map((slot, idx) => (idx === 0 ? { ...slot, currentPp: 0 } : slot)) };
    expect(selectWildMoveIndex(wild, always(0.9))).toBe(1);
    expect(selectWildMoveIndex(noTackle, always(0))).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { createPokemonInstance, executeBattleTurn, healParty, startTrainerBattle, startWildBattle, throwPokeball, type PokemonInstance } from './battle';
import { orderActions, resolveTurn, effectiveSpeed } from './battleTurn';
import { resolveFaints, switchPlayerIn } from './battleParty';
import { calculateDamage, rollCritical, rollHitCount } from './damage';
import { genSixCatchShakeThreshold, genSixCriticalCaptureOdds, rollGenSixCapture } from './battleCapture';
import { applyEntryHazards, createBattleField, setEntryHazard } from './battleField';
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

  it('uses Gen VI level-based OHKO accuracy and Sheer Cold type penalty', () => {
    const fissure = move('Fissure');
    const sheerCold = move('Sheer Cold');
    const user = pokemon('torchic', 30, 'Fissure', 'Sheer Cold');
    const sameLevel = pokemon('wurmple', 30, 'Tackle');
    const higherLevel = pokemon('wurmple', 31, 'Tackle');
    const iceUser = pokemon('snover', 30, 'Sheer Cold');

    expect(rollAccuracy(user, higherLevel, fissure, always(0))).toBe(false);
    expect(rollAccuracy(user, sameLevel, sheerCold, always(0.199))).toBe(true);
    expect(rollAccuracy(user, sameLevel, sheerCold, always(0.2))).toBe(false);
    expect(rollAccuracy(iceUser, sameLevel, sheerCold, always(0.299))).toBe(true);
    expect(rollAccuracy(iceUser, sameLevel, sheerCold, always(0.3))).toBe(false);
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

  it('orders across Gen VI priority brackets, including negative priority', () => {
    const slow = pokemon('wurmple', 5, 'Extreme Speed');
    const fast = { ...pokemon('torchic', 5, 'Whirlwind'), speed: 999 };
    const state = startWildBattle(slow, fast);
    const [first] = orderActions(state, { side: 'player', moveIndex: 0 }, { side: 'enemy', moveIndex: 0 }, always(0.9));
    expect(first.side).toBe('player');
    expect(move('Extreme Speed').priority).toBe(2);
    expect(move('Whirlwind').priority).toBe(-6);
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

describe('weather and Gen VI abilities', () => {
  it('modifies Fire and Water damage under sun and rain', () => {
    const fireUser = pokemon('torchic', 30, 'Ember');
    const waterUser = pokemon('mudkip', 30, 'Water Gun');
    const target = pokemon('wurmple', 30, 'Tackle');
    const ember = move('Ember');
    const waterGun = move('Water Gun');

    expect(calculateDamage(fireUser, target, ember, always(1), { weather: 'sun' })).toBeGreaterThan(
      calculateDamage(fireUser, target, ember, always(1))
    );
    expect(calculateDamage(waterUser, target, waterGun, always(1), { weather: 'sun' })).toBeLessThan(
      calculateDamage(waterUser, target, waterGun, always(1))
    );
    expect(calculateDamage(waterUser, target, waterGun, always(1), { weather: 'rain' })).toBeGreaterThan(
      calculateDamage(waterUser, target, waterGun, always(1))
    );
    expect(calculateDamage(fireUser, target, ember, always(1), { weather: 'rain' })).toBeLessThan(
      calculateDamage(fireUser, target, ember, always(1))
    );
  });

  it.each([
    ['torchic', 'Ember', 'Blaze'],
    ['mudkip', 'Water Gun', 'Torrent'],
    ['treecko', 'Absorb', 'Overgrow'],
  ])('%s gets its starter ability bonus at one-third HP', (speciesId, moveName, ability) => {
    const base = pokemon(speciesId, 30, moveName);
    const target = pokemon('wurmple', 30, 'Tackle');
    const healthy = { ...base, maxHp: 30, currentHp: 11, ability };
    const criticalHp = { ...healthy, currentHp: 10 };
    const damage = (attacker: PokemonInstance) => calculateDamage(attacker, target, move(moveName), always(1));

    expect(damage(criticalHp)).toBeGreaterThan(damage(healthy));
  });

  it('applies Intimidate when a Pokémon enters battle', () => {
    const intimidator = { ...pokemon('poochyena', 10, 'Tackle'), ability: 'Intimidate' };
    const target = pokemon('wurmple', 10, 'Tackle');
    const battle = startWildBattle(intimidator, target);

    expect(battle.enemy.stages.atk).toBe(-1);
    expect(battle.log).toContain("Wurmple teve o Ataque reduzido por Intimidate!");
  });

  it('triggers Intimidate on player switch-in and trainer send-out', () => {
    const intimidator = { ...pokemon('poochyena', 10, 'Tackle'), ability: 'Intimidate' };
    const target = pokemon('wurmple', 10, 'Tackle');
    const switched = switchPlayerIn(startWildBattle([target, intimidator], pokemon('zigzagoon', 10, 'Tackle')), 1);
    const trainer = startTrainerBattle(target, [pokemon('zigzagoon', 10, 'Tackle'), intimidator], 'Treinador');
    const fainted = { ...trainer.enemy, currentHp: 0 };
    const nextEnemy = resolveFaints({ ...trainer, enemy: fainted, enemyParty: [fainted, intimidator] });

    expect(switched.enemy.stages.atk).toBe(-1);
    expect(nextEnemy.enemy.ability).toBe('Intimidate');
    expect(nextEnemy.player.stages.atk).toBe(-1);
  });

  it('lets Sturdy survive a lethal hit only from full HP and blocks OHKO moves', () => {
    const attacker = pokemon('torchic', 100, 'Flamethrower', 'Fissure');
    const target = { ...pokemon('wurmple', 2, 'Tackle'), ability: 'Sturdy' };
    const saved = executeMove(attacker, target, move('Flamethrower'), always(0));
    const chipped = executeMove(attacker, { ...target, currentHp: target.maxHp - 1 }, move('Flamethrower'), always(0));
    const ohko = executeMove(attacker, target, move('Fissure'), always(0));

    expect(saved.target.currentHp).toBe(1);
    expect(chipped.target.currentHp).toBe(0);
    expect(ohko.target.currentHp).toBe(target.currentHp);
  });

  it('makes Ground moves ineffective against Levitate', () => {
    const attacker = pokemon('torchic', 30, 'Earthquake');
    const levitating = { ...pokemon('wurmple', 30, 'Tackle'), ability: 'Levitate' };
    const fissure = executeMove(pokemon('torchic', 30, 'Fissure'), levitating, move('Fissure'), always(0));

    expect(calculateDamage(attacker, levitating, move('Earthquake'), always(1))).toBe(0);
    expect(fissure.target.currentHp).toBe(levitating.currentHp);
  });

  it('applies weather damage and Rock special-defense immunity correctly', () => {
    const ordinary = pokemon('torchic', 20, 'Tackle');
    const rock = pokemon('kabuto', 20, 'Tackle');
    const hail = applyResidualDamage(ordinary, 'hail').pokemon;
    const sandstorm = applyResidualDamage(rock, 'sandstorm').pokemon;
    const fireUser = pokemon('torchic', 30, 'Ember');
    const target = pokemon('wurmple', 30, 'Tackle');

    expect(hail.currentHp).toBe(ordinary.currentHp - Math.max(1, Math.floor(ordinary.maxHp / 16)));
    expect(sandstorm.currentHp).toBe(rock.currentHp);
    expect(applyResidualDamage({ ...ordinary, ability: 'Magic Guard' }, 'hail').pokemon.currentHp).toBe(ordinary.currentHp);
    expect(applyResidualDamage(pokemon('snover', 20, 'Tackle'), 'hail').pokemon.currentHp).toBe(
      pokemon('snover', 20, 'Tackle').currentHp
    );
    expect(calculateDamage(fireUser, target, move('Ember'), always(1), { weather: 'sun', weatherSuppressed: true })).toBe(
      calculateDamage(fireUser, target, move('Ember'), always(1))
    );
    const specialAttacker = pokemon('torchic', 30, 'Psychic');
    expect(calculateDamage(specialAttacker, rock, move('Psychic'), always(1), { weather: 'sandstorm' })).toBeLessThan(
      calculateDamage(specialAttacker, rock, move('Psychic'), always(1))
    );
  });

  it('starts weather and screens through their moves and counts the setup turn', () => {
    const weatherBattle = startWildBattle(pokemon('torchic', 20, 'Sunny Day'), pokemon('wurmple', 5, 'Tackle'));
    const screenBattle = startWildBattle(pokemon('torchic', 20, 'Reflect'), pokemon('wurmple', 5, 'Tackle'));
    const weather = executeBattleTurn(weatherBattle, 0, always(0.5));
    const screen = executeBattleTurn(screenBattle, 0, always(0.5));

    expect(weather.field.weather).toEqual({ kind: 'sun', turns: 4 });
    expect(screen.field.screens.player.reflect).toBe(4);
  });

  it.each([
    ['Sunny Day', 'sun'],
    ['Rain Dance', 'rain'],
    ['Sandstorm', 'sandstorm'],
    ['Hail', 'hail'],
  ] as const)('%s sets a five-turn %s weather state', (moveName, weather) => {
    const battle = startWildBattle(pokemon('torchic', 20, moveName), pokemon('wurmple', 5, 'Tackle'));
    const next = executeBattleTurn(battle, 0, always(0.5));

    expect(next.field.weather).toEqual({ kind: weather, turns: 4 });
  });

  it('applies and bypasses Reflect and Light Screen as Gen VI does', () => {
    const attacker = pokemon('torchic', 30, 'Tackle', 'Psychic');
    const target = pokemon('wurmple', 30, 'Tackle');
    const normal = calculateDamage(attacker, target, move('Tackle'), always(1));
    const reflected = calculateDamage(attacker, target, move('Tackle'), always(1), { screen: 'reflect' });
    const critical = calculateDamage(attacker, target, move('Tackle'), always(1), { screen: 'reflect', critical: true });
    const special = calculateDamage(attacker, target, move('Psychic'), always(1), { screen: 'lightScreen' });

    expect(reflected).toBeLessThan(normal);
    expect(critical).toBe(normal * 1.5);
    expect(special).toBeLessThan(calculateDamage(attacker, target, move('Psychic'), always(1)));
  });
});

describe('critical modifiers', () => {
  it('adds Super Luck and Scope Lens crit stages and applies Sniper damage', () => {
    const target = pokemon('wurmple', 20, 'Tackle');
    const user = pokemon('torchic', 30, 'Tackle');
    expect(rollCritical(target, move('Tackle'), always(0.12), { ...user, ability: 'Super Luck' })).toBe(true);
    expect(rollCritical(target, move('Tackle'), always(0.13), { ...user, heldItem: 'Scope Lens' })).toBe(false);
    const normal = calculateDamage(user, target, move('Tackle'), always(1), { critical: true });
    const sniper = calculateDamage({ ...user, ability: 'Sniper' }, target, move('Tackle'), always(1), { critical: true });

    expect(sniper).toBeGreaterThan(normal);
  });
});

describe('entry hazards and volatile move effects', () => {
  it('treats Splash as the ROM-described no-effect move', () => {
    const user = pokemon('magikarp', 10, 'Splash');
    const target = pokemon('poochyena', 10, 'Tackle');

    const outcome = executeMove(user, target, move('Splash'), always(0));

    expect(outcome.user).toBe(user);
    expect(outcome.target).toBe(target);
    expect(outcome.messages).toEqual(['Magikarp usou Splash!', 'Mas não teve efeito!']);
  });

  it('stacks Spikes to three layers and applies grounded damage', () => {
    let field = createBattleField();
    for (let layer = 0; layer < 4; layer += 1) field = setEntryHazard(field, 'player', 'spikes').field;
    const target = { ...pokemon('wurmple', 10, 'Tackle'), maxHp: 96, currentHp: 96 };
    const result = applyEntryHazards(field, 'player', target);

    expect(field.hazards.player.spikes).toBe(3);
    expect(result.pokemon.currentHp).toBe(72);
    expect(applyEntryHazards(field, 'player', { ...target, ability: 'Levitate' }).pokemon.currentHp).toBe(96);
  });

  it('applies Stealth Rock by type effectiveness and Toxic Spikes on entry', () => {
    let field = createBattleField();
    field = setEntryHazard(field, 'player', 'stealthRock').field;
    field = setEntryHazard(field, 'player', 'toxicSpikes').field;
    field = setEntryHazard(field, 'player', 'toxicSpikes').field;
    const target = pokemon('torchic', 10, 'Tackle');
    const result = applyEntryHazards(field, 'player', target);

    expect(result.pokemon.currentHp).toBe(target.currentHp - Math.floor(target.maxHp / 4));
    expect(result.pokemon.status).toEqual({ kind: 'toxic', counter: 1 });
    expect(result.field.hazards.player.toxicSpikes).toBe(2);
  });

  it('clears volatile effects on switch, while major status remains', () => {
    const seeded = { ...pokemon('torchic', 10, 'Tackle'), status: { kind: 'burn' as const, counter: 0 },
      volatile: { confusionTurns: 3, leechSeeded: true, tauntTurns: 2, protectStreak: 1, protecting: false } };
    const battle = startWildBattle([seeded, pokemon('mudkip', 10, 'Tackle')], pokemon('wurmple', 10, 'Tackle'));
    const active = { ...battle.player, ...seeded };
    const ready = { ...battle, player: active, playerParty: [active, ...battle.playerParty.slice(1)] };
    const switched = switchPlayerIn(ready, 1);

    expect(switched.playerParty[0]).toMatchObject({ status: { kind: 'burn' }, volatile: { confusionTurns: 0, leechSeeded: false, tauntTurns: 0 } });
  });

  it('confuses for a ROM duration and resolves a 40-power self-hit', () => {
    const user = pokemon('zigzagoon', 20, 'Tackle');
    const target = pokemon('torchic', 20, 'Confusion');
    const confused = executeMove(user, target, move('Confusion'), always(0)).target;
    const result = checkCanAct({ ...confused, volatile: { ...confused.volatile, confusionTurns: 2 } }, always(0));

    expect(confused.volatile.confusionTurns).toBe(2);
    expect(result.canAct).toBe(false);
    expect(result.pokemon.currentHp).toBeLessThan(target.currentHp);
  });

  it('sets Leech Seed and Taunt, and Swagger/Flatter raise stats and confuse', () => {
    const user = pokemon('zigzagoon', 20, 'Tackle');
    const target = pokemon('torchic', 20, 'Tackle');
    const seeded = executeMove(user, target, move('Leech Seed'), always(0)).target;
    const taunted = executeMove(user, target, move('Taunt'), always(0)).target;
    const swagger = executeMove(user, target, move('Swagger'), always(0)).target;
    const flatter = executeMove(user, target, move('Flatter'), always(0)).target;

    expect(seeded.volatile.leechSeeded).toBe(true);
    expect(taunted.volatile.tauntTurns).toBe(3);
    expect(swagger).toMatchObject({ stages: { atk: 2 }, volatile: { confusionTurns: 2 } });
    expect(flatter).toMatchObject({ stages: { spa: 1 }, volatile: { confusionTurns: 2 } });
  });

  it('protects against an attack and forces a trainer replacement with Roar', () => {
    const protectedBattle = startWildBattle(pokemon('torchic', 20, 'Protect'), pokemon('wurmple', 20, 'Tackle'));
    const protectedTurn = executeBattleTurn(protectedBattle, 0, always(0));
    const trainer = startTrainerBattle(pokemon('torchic', 20, 'Roar'), [pokemon('wurmple', 20, 'Tackle'), pokemon('zigzagoon', 20, 'Tackle')], 'Treinador');
    const playerFirst = { ...trainer, player: { ...trainer.player, speed: 999 }, playerParty: trainer.playerParty.map((p, i) => i ? p : { ...p, speed: 999 }) };
    const forced = executeBattleTurn(playerFirst, 0, always(0.9));

    expect(protectedTurn.enemy.currentHp).toBe(protectedBattle.enemy.currentHp);
    expect(forced.enemyActive).toBe(1);
  });
});

describe('Gen VI capture formula', () => {
  it('uses species catch rate, remaining HP and status multipliers for shake checks', () => {
    const wild = pokemon('poochyena', 5, 'Tackle');
    const fullHp = genSixCatchShakeThreshold(wild);
    const weakened = genSixCatchShakeThreshold({ ...wild, currentHp: 1 });
    const asleep = genSixCatchShakeThreshold({ ...wild, status: { kind: 'sleep', counter: 2 } });

    expect(fullHp).toBeCloseTo(53335.908, 2);
    expect(weakened).toBeGreaterThan(fullHp);
    expect(asleep).toBeGreaterThan(fullHp);
  });

  it('requires four successful shake checks to catch and uses the enemy turn after a breakout', () => {
    const battle = startWildBattle(pokemon('torchic', 5, 'Scratch'), pokemon('poochyena', 5, 'Tackle'));
    const caught = throwPokeball(battle, always(0));
    const escaped = throwPokeball(battle, always(0.99));

    expect(caught.status).toBe('caught');
    expect(escaped.status).toBe('ongoing');
    expect(escaped.turn).toBe(2);
  });

  it('adds the Pokédex based critical-capture odds and single shake check', () => {
    const target = pokemon('bulbasaur', 5, 'Tackle');
    expect(target.species.catchRate).toBe(45);
    expect(genSixCriticalCaptureOdds(target, 30)).toBe(0);
    expect(genSixCriticalCaptureOdds(target, 151)).toBe(2);
    expect(rollGenSixCapture(target, always(0), 151)).toBe(true);
    expect(throwPokeball(startWildBattle(pokemon('torchic', 5, 'Scratch'), target), always(0), 151).status).toBe('caught');
  });
});

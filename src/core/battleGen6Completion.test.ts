import { describe, expect, it } from 'vitest';
import { createPokemonInstance, executeBattleTurn, startTrainerBattle, startWildBattle, type PokemonInstance } from './battle';
import { calculateDamage } from './damage';
import { getMoveByName, getSpeciesById } from './dex';
import { executeMove } from './moveExecution';
import { toBattleMove } from './battlePokemon';
import { chooseTrainerAction } from './battleAi';
import { applyEndTurnHeldItem, choiceSpeedMultiplier } from './battleHeldItems';
import { effectiveSpeed } from './battleTurn';

const always = (value: number) => () => value;
const move = (name: string) => toBattleMove(getMoveByName(name));

function pokemon(id: string, level: number, ...moves: string[]): PokemonInstance {
  return createPokemonInstance(getSpeciesById(id), level, moves.map((name) => getMoveByName(name).id));
}

describe('Gen VI substitute and charge moves', () => {
  it('creates a quarter-HP substitute that absorbs damage and blocks status', () => {
    const user = pokemon('treecko', 30, 'Substitute');
    const target = pokemon('wurmple', 30, 'Tackle');
    const created = executeMove({ ...user, currentHp: user.maxHp - 20 }, target, move('Substitute'), always(0));
    const hit = executeMove(target, created.user, move('Tackle'), always(1));
    const status = executeMove(pokemon('torchic', 30, 'Growl'), created.user, move('Growl'), always(0));

    expect(created.user.currentHp).toBe(user.maxHp - 20 - Math.floor(user.maxHp / 4));
    expect(created.user.volatile.substituteHp).toBe(Math.floor(user.maxHp / 4));
    expect(hit.target.currentHp).toBe(created.user.currentHp);
    expect(hit.target.volatile.substituteHp ?? 0).toBeLessThan(created.user.volatile.substituteHp ?? 0);
    expect(status.user.stages.atk).toBe(0);
  });

  it.each(['Fly', 'Dig', 'Solar Beam'])('charges %s and executes it on the next chosen turn', (name) => {
    const battle = startWildBattle(pokemon('torchic', 30, name, 'Scratch'), pokemon('wurmple', 30, 'Tackle'));
    const charging = executeBattleTurn(battle, 0, always(0.5));
    const attacking = executeBattleTurn(charging, 1, always(0.5));

    expect(charging.player.volatile.chargeMoveId).toBe(getMoveByName(name).id);
    expect(charging.enemy.currentHp).toBe(battle.enemy.currentHp);
    if (name !== 'Solar Beam') expect(charging.player.currentHp).toBe(battle.player.currentHp);
    expect(attacking.player.volatile.chargeMoveId).toBeNull();
    expect(attacking.enemy.currentHp).toBeLessThan(charging.enemy.currentHp);
    expect(attacking.player.moves[0]?.currentPp).toBe(battle.player.moves[0]?.currentPp - 1);
  });

  it('charges through Protect on turn one and consumes the charge when blocked on turn two', () => {
    const battle = startWildBattle(pokemon('torchic', 30, 'Fly'), pokemon('wurmple', 30, 'Protect'));
    const charging = executeBattleTurn(battle, 0, always(0));
    const blocked = executeBattleTurn(charging, 0, always(0));

    expect(charging.player.volatile.chargeMoveId).toBe(getMoveByName('Fly').id);
    expect(blocked.player.volatile.chargeMoveId).toBeNull();
    expect(blocked.enemy.currentHp).toBe(battle.enemy.currentHp);
  });
});

describe('Gen VI held items and abilities', () => {
  const target = pokemon('wurmple', 30, 'Tackle');

  it('applies Technician, Adaptability, Guts and Huge Power damage modifiers', () => {
    const scratch = move('Scratch');
    const physical = pokemon('torchic', 30, 'Scratch');
    const special = pokemon('torchic', 30, 'Ember');
    const normal = calculateDamage(physical, target, scratch, always(1));

    expect(calculateDamage({ ...physical, ability: 'Technician' }, target, scratch, always(1))).toBeGreaterThan(normal);
    expect(calculateDamage({ ...special, ability: 'Adaptability' }, target, move('Ember'), always(1))).toBeGreaterThan(
      calculateDamage(special, target, move('Ember'), always(1))
    );
    expect(calculateDamage({ ...physical, ability: 'Guts', status: { kind: 'burn', counter: 0 } }, target, scratch, always(1)))
      .toBeGreaterThan(calculateDamage({ ...physical, status: { kind: 'burn', counter: 0 } }, target, scratch, always(1)));
    expect(calculateDamage({ ...physical, ability: 'Huge Power' }, target, scratch, always(1))).toBeGreaterThan(normal);
  });

  it('uses Choice and Life Orb boosts, Eviolite defense, and Focus Sash survival', () => {
    const physical = pokemon('torchic', 30, 'Scratch');
    const base = calculateDamage(physical, target, move('Scratch'), always(1));
    const choice = { ...physical, heldItem: 'Choice Band' };
    const lifeOrb = { ...physical, heldItem: 'Life Orb' };
    const eviolite = { ...target, heldItem: 'Eviolite' };
    const finalStage = { ...pokemon('charizard', 30, 'Tackle'), heldItem: 'Eviolite' };
    const sash = { ...target, heldItem: 'Focus Sash' };
    const lethal = { ...pokemon('torchic', 100, 'Flamethrower'), ability: 'Blaze' };

    expect(calculateDamage(choice, target, move('Scratch'), always(1))).toBeGreaterThan(base);
    expect(calculateDamage(lifeOrb, target, move('Scratch'), always(1))).toBeGreaterThan(base);
    expect(calculateDamage(physical, eviolite, move('Scratch'), always(1))).toBeLessThan(
      calculateDamage(physical, target, move('Scratch'), always(1))
    );
    expect(calculateDamage(physical, finalStage, move('Scratch'), always(1))).toBe(
      calculateDamage(physical, { ...finalStage, heldItem: null }, move('Scratch'), always(1))
    );
    expect(executeMove(lethal, sash, move('Flamethrower'), always(1)).target).toMatchObject({ currentHp: 1, heldItem: null });
    expect(choiceSpeedMultiplier({ ...physical, heldItem: 'Choice Scarf' })).toBe(1.5);
    expect(calculateDamage({ ...physical, heldItem: 'Choice Specs' }, target, move('Ember'), always(1))).toBeGreaterThan(
      calculateDamage(physical, target, move('Ember'), always(1))
    );
    expect(effectiveSpeed({ ...physical, heldItem: 'Choice Scarf' })).toBe(Math.floor(physical.speed * 1.5));
  });

  it('activates Sitrus Berry and Leftovers and locks a Choice move until switching', () => {
    const berryBase = pokemon('torchic', 30, 'Scratch', 'Growl');
    const berry = { ...berryBase, heldItem: 'Sitrus Berry', currentHp: Math.floor(berryBase.maxHp / 2) };
    const choice = { ...pokemon('torchic', 30, 'Scratch', 'Growl'), heldItem: 'Choice Band', speed: 999 };
    const foe = { ...pokemon('wurmple', 30, 'Tackle'), speed: 1 };
    const healed = executeBattleTurn(startWildBattle(berry, foe), 0, always(0.99));
    const noBerry = executeBattleTurn(startWildBattle({ ...berry, heldItem: null }, foe), 0, always(0.99));
    const leftovers = { ...berry, heldItem: 'Leftovers', currentHp: berry.maxHp - 10 };
    const recovered = executeBattleTurn(startWildBattle(leftovers, foe), 0, always(0.99));
    const noLeftovers = executeBattleTurn(startWildBattle({ ...leftovers, heldItem: null }, foe), 0, always(0.99));
    const firstChoice = executeBattleTurn(startWildBattle(choice, foe), 0, always(0.99));
    const blocked = executeBattleTurn(firstChoice, 1, always(0.99));

    expect(healed.player.heldItem).toBeNull();
    expect(healed.player.currentHp).toBeGreaterThan(noBerry.player.currentHp);
    expect(recovered.player.currentHp).toBeGreaterThan(noLeftovers.player.currentHp);
    expect(firstChoice.player.volatile.choiceLockMoveId).toBe(getMoveByName('Scratch').id);
    expect(blocked.player.moves[1]?.currentPp).toBe(blocked.player.moves[1]?.maxPp);
    expect(blocked.log.some((line) => line.includes('Choice'))).toBe(true);
  });

  it('activates contact abilities, type immunities, Flash Fire, and Speed Boost', () => {
    const attacker = pokemon('torchic', 30, 'Scratch');
    const target = pokemon('wurmple', 30, 'Tackle');
    const staticTarget = { ...pokemon('pikachu', 30, 'Thunder Shock'), ability: 'Static' };
    const burned = executeMove(attacker, staticTarget, move('Scratch'), always(0));
    const flashFire = { ...pokemon('torchic', 30, 'Ember'), ability: 'Flash Fire' };
    const absorbed = executeMove(pokemon('torchic', 30, 'Ember'), flashFire, move('Ember'), always(0));
    const boosted = executeMove(absorbed.user, target, move('Ember'), always(1));
    const waterAbsorb = { ...pokemon('mudkip', 30, 'Water Gun'), ability: 'Water Absorb', currentHp: 1 };
    const healed = executeMove(pokemon('mudkip', 30, 'Water Gun'), waterAbsorb, move('Water Gun'), always(0));
    const speedBoost = { ...pokemon('torchic', 30, 'Scratch'), ability: 'Speed Boost', speed: 999 };
    const aged = executeBattleTurn(startWildBattle(speedBoost, target), 0, always(0.99));

    expect(burned.user.status?.kind).toBe('paralysis');
    expect(absorbed.target.currentHp).toBe(flashFire.currentHp);
    expect(absorbed.target.volatile.flashFireActive).toBe(true);
    expect(boosted.target.currentHp).toBeLessThan(target.currentHp);
    expect(healed.target.currentHp).toBeGreaterThan(1);
    expect(aged.player.stages.spe).toBe(1);
  });

  it.each([
    ['Static', 'pikachu', 'paralysis'],
    ['Flame Body', 'magmar', 'burn'],
    ['Poison Point', 'bulbasaur', 'poison'],
  ] as const)('%s inflicts its contact status', (ability, species, status) => {
    const attacker = pokemon('mudkip', 30, 'Scratch');
    const defender = { ...pokemon(species, 30, 'Tackle'), ability };
    expect(executeMove(attacker, defender, move('Scratch'), always(0)).user.status?.kind).toBe(status);
  });

  it('applies Rock Head immunity to move recoil and consumes Oran Berry at half HP', () => {
    const attacker = pokemon('aerodactyl', 30, 'Take Down');
    const target = pokemon('wurmple', 30, 'Tackle');
    const hit = executeMove({ ...attacker, ability: 'Rock Head' }, target, move('Take Down'), always(0.5));
    const oran = { ...attacker, heldItem: 'Oran Berry', currentHp: Math.floor(attacker.maxHp / 2) };
    const recovered = applyEndTurnHeldItem(oran);

    expect(hit.user.currentHp).toBe(attacker.currentHp);
    expect(recovered.pokemon.currentHp).toBe(oran.currentHp + 10);
    expect(recovered.pokemon.heldItem).toBeNull();
  });

  it('applies Life Orb recoil after a successful damaging move', () => {
    const user = { ...pokemon('torchic', 30, 'Ember'), heldItem: 'Life Orb' };
    const outcome = executeMove(user, target, move('Ember'), always(0.5));

    expect(outcome.user.currentHp).toBe(user.currentHp - Math.floor(user.maxHp / 10));
  });

  it('absorbs Volt moves and heals the holder', () => {
    const user = pokemon('pikachu', 30, 'Thunder Shock');
    const holder = { ...pokemon('jolteon', 30, 'Tackle'), currentHp: 1, ability: 'Volt Absorb' };
    const outcome = executeMove(user, holder, move('Thunder Shock'), always(0));

    expect(outcome.target.currentHp).toBeGreaterThan(1);
    expect(outcome.target.currentHp).toBeLessThan(holder.maxHp);
  });
});

describe('trainer switching decision', () => {
  it('switches to a bench Pokémon when its matchup is clearly better', () => {
    const active = pokemon('treecko', 30, 'Absorb');
    const bench = pokemon('mudkip', 30, 'Water Gun');
    const target = pokemon('torchic', 30, 'Ember');

    expect(chooseTrainerAction([active, bench], 0, target, always(0))).toEqual({ kind: 'switch', partyIndex: 1 });
    const battle = startTrainerBattle(target, [active, bench], 'Treinador');
    const turn = executeBattleTurn(battle, 0, always(0));
    expect(turn.enemyActive).toBe(1);
  });
});

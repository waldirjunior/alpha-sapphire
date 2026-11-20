import { describe, expect, it } from 'vitest';
import { advanceVolatileTurn, applyResidualDamage } from './statusConditions';
import { createPokemonInstance, executeBattleTurn, startWildBattle, switchActivePokemon, type PokemonInstance } from './battle';
import { getMoveByName, getSpeciesById } from './dex';
import { executeMove } from './moveExecution';
import { toBattleMove } from './battlePokemon';

const always = (value: number) => () => value;
const move = (name: string) => toBattleMove(getMoveByName(name));

function pokemon(speciesId: string, level: number, ...moves: string[]): PokemonInstance {
  return createPokemonInstance(getSpeciesById(speciesId), level, moves.map((name) => getMoveByName(name).id));
}

function sequence(...values: number[]) {
  return () => values.shift() ?? 0.99;
}

describe('Gen VI entry abilities and combat abilities', () => {
  it.each([
    ['Drizzle', 'rain'],
    ['Drought', 'sun'],
    ['Sand Stream', 'sandstorm'],
    ['Snow Warning', 'hail'],
  ] as const)('%s starts its five-turn weather on entry', (ability, weather) => {
    const player = { ...pokemon('torchic', 20, 'Tackle'), ability };
    const battle = startWildBattle(player, pokemon('wurmple', 20, 'Splash'));

    expect(battle.field.weather).toEqual({ kind: weather, turns: 5 });
  });

  it('starts weather again when its ability enters through a switch', () => {
    const lead = pokemon('torchic', 20, 'Tackle');
    const drizzle = { ...pokemon('treecko', 20, 'Tackle'), ability: 'Drizzle' };
    const battle = startWildBattle([lead, drizzle], pokemon('wurmple', 20, 'Splash'));
    const switched = switchActivePokemon(battle, 1, always(0.99));

    expect(switched.field.weather).toEqual({ kind: 'rain', turns: 4 });
  });

  it('raises Attack with Moxie after a direct knockout', () => {
    const player = { ...pokemon('torchic', 20, 'Tackle'), ability: 'Moxie', speed: 999 };
    const enemy = { ...pokemon('wurmple', 20, 'Splash'), currentHp: 1, speed: 1 };
    const result = executeBattleTurn(startWildBattle(player, enemy), 0, always(0.99));

    expect(result.player.stages.atk).toBe(1);
  });

  it('activates Moxie after a one-hit knockout move', () => {
    const user = { ...pokemon('torchic', 30, 'Fissure'), ability: 'Moxie' };
    const result = executeMove(user, pokemon('wurmple', 30, 'Splash'), move('Fissure'), always(0));

    expect(result.target.currentHp).toBe(0);
    expect(result.user.stages.atk).toBe(1);
  });

  it('boosts secondary-effect damage with Sheer Force and suppresses the effect', () => {
    const user = pokemon('torchic', 30, 'Ember');
    const target = pokemon('wurmple', 60, 'Splash');
    const normal = executeMove(user, target, move('Ember'), sequence(0.99, 0.99, 1, 0));
    const sheerForce = executeMove({ ...user, ability: 'Sheer Force' }, target, move('Ember'), sequence(0.99, 0.99, 1, 0));

    expect(target.currentHp - sheerForce.target.currentHp).toBeGreaterThan(target.currentHp - normal.target.currentHp);
    expect(normal.target.status?.kind).toBe('burn');
    expect(sheerForce.target.status).toBeNull();
    const lifeOrbSheerForce = { ...user, ability: 'Sheer Force', heldItem: 'Life Orb' };
    const noRecoil = executeMove(lifeOrbSheerForce, target, move('Ember'), sequence(0.99, 0.99, 1));
    expect(noRecoil.user.currentHp).toBe(lifeOrbSheerForce.currentHp);
  });

  it('keeps Overheat’s primary stat drop and does not boost its power', () => {
    const user = pokemon('torchic', 30, 'Overheat');
    const target = pokemon('wailmer', 60, 'Splash');
    const normal = executeMove(user, target, move('Overheat'), sequence(0.5, 0.99, 1, 0.99));
    const sheerForce = executeMove({ ...user, ability: 'Sheer Force' }, target, move('Overheat'), sequence(0.5, 0.99, 1, 0.99));

    expect(target.currentHp - sheerForce.target.currentHp).toBe(target.currentHp - normal.target.currentHp);
    expect(sheerForce.user.stages.spa).toBe(-2);
  });

  it('suppresses Sheer Force flinch and opposing stat-drop effects', () => {
    const user = pokemon('torchic', 30, 'Bite');
    const target = pokemon('wailmer', 60, 'Splash');
    const normalFlinch = executeMove(user, target, move('Bite'), sequence(0.99, 0.99, 1, 0));
    const sheerFlinch = executeMove({ ...user, ability: 'Sheer Force' }, target, move('Bite'), sequence(0.99, 0.99, 1, 0));
    const normalDrop = executeMove(pokemon('torchic', 30, 'Crunch'), target, move('Crunch'), sequence(0.99, 0.99, 1, 0));
    const sheerDrop = executeMove({ ...pokemon('torchic', 30, 'Crunch'), ability: 'Sheer Force' }, target, move('Crunch'), sequence(0.99, 0.99, 1, 0));

    expect(normalFlinch.flinched).toBe(true);
    expect(sheerFlinch.flinched).toBe(false);
    expect(normalDrop.target.stages.def).toBe(-1);
    expect(sheerDrop.target.stages.def).toBe(0);
  });

  it('blocks indirect residual and Life Orb damage with Magic Guard', () => {
    const base = pokemon('clefairy', 30, 'Tackle');
    const protectedPokemon = {
      ...base,
      ability: 'Magic Guard',
      currentHp: base.maxHp - 20,
      status: { kind: 'burn' as const, counter: 0 },
      volatile: { ...base.volatile, leechSeeded: true, partialTrapTurns: 2 },
    };
    const residual = applyResidualDamage(protectedPokemon, 'hail');
    const user = { ...pokemon('torchic', 30, 'Tackle'), ability: 'Magic Guard', heldItem: 'Life Orb' };
    const attack = executeMove(user, pokemon('wurmple', 30, 'Splash'), move('Tackle'), always(0.99));
    const recoilUser = { ...user, heldItem: null };
    const recoil = executeMove(recoilUser, pokemon('wurmple', 30, 'Splash'), move('Struggle'), always(0.99));

    expect(residual.pokemon.currentHp).toBe(protectedPokemon.currentHp);
    expect(residual.message).toBeNull();
    expect(attack.user.currentHp).toBe(user.currentHp);
    expect(recoil.user.currentHp).toBe(recoilUser.currentHp);
  });

  it('cures a Natural Cure Pokémon when it leaves the field', () => {
    const lead = {
      ...pokemon('treecko', 20, 'Tackle'),
      ability: 'Natural Cure',
      status: { kind: 'poison' as const, counter: 0 },
    };
    const battle = startWildBattle([lead, pokemon('torchic', 20, 'Tackle')], pokemon('wurmple', 20, 'Splash'));
    expect(battle.player.status?.kind).toBe('poison');
    const switched = switchActivePokemon(battle, 1, always(0.99));

    expect(switched.playerActive).toBe(1);
    expect(switched.playerParty[0]?.status).toBeNull();
  });

  it.each(['Rough Skin', 'Iron Barbs'])('%s deals 1/8 max HP on contact', (ability) => {
    const attacker = pokemon('torchic', 20, 'Tackle');
    const defender = { ...pokemon('wurmple', 20, 'Splash'), ability };
    const result = executeMove(attacker, defender, move('Tackle'), always(0.99));

    expect(attacker.currentHp - result.user.currentHp).toBe(Math.max(1, Math.floor(defender.maxHp / 8)));
  });

  it('still triggers Rough Skin when the contact hit knocks out its owner', () => {
    const attacker = pokemon('torchic', 30, 'Tackle');
    const defender = { ...pokemon('wurmple', 20, 'Splash'), ability: 'Rough Skin', currentHp: 1 };
    const result = executeMove(attacker, defender, move('Tackle'), always(0.99));

    expect(result.target.currentHp).toBe(0);
    expect(attacker.currentHp - result.user.currentHp).toBe(Math.max(1, Math.floor(attacker.maxHp / 8)));
  });

  it('lets Magic Guard ignore Rough Skin contact damage', () => {
    const attacker = { ...pokemon('torchic', 20, 'Tackle'), ability: 'Magic Guard' };
    const defender = { ...pokemon('wurmple', 20, 'Splash'), ability: 'Rough Skin' };
    const result = executeMove(attacker, defender, move('Tackle'), always(0.99));

    expect(result.user.currentHp).toBe(attacker.currentHp);
  });
});

describe('Gen VI trapping and Baton Pass', () => {
  it.each(['Bind', 'Wrap', 'Fire Spin', 'Whirlpool'])('%s traps for four or five turns and deals 1/8 HP', (name) => {
    const user = pokemon('torchic', 20, name);
    const target = pokemon('wurmple', 50, 'Splash');
    const hit = executeMove(user, target, move(name), sequence(0.5, 0.99, 0.99, 0, 0));
    const residual = applyResidualDamage(hit.target);

    expect(hit.target.volatile.partialTrapTurns).toBe(4);
    expect(residual.pokemon.currentHp).toBe(hit.target.currentHp - Math.floor(target.maxHp / 8));
  });

  it('can roll the five-turn duration and decrements it at end of turn', () => {
    const target = pokemon('wurmple', 50, 'Splash');
    const hit = executeMove(pokemon('torchic', 20, 'Bind'), target, move('Bind'), sequence(0.5, 0.99, 0.99, 0, 0.99));
    let trapped = hit.target;
    let pulses = 0;
    while ((trapped.volatile.partialTrapTurns ?? 0) > 0) {
      trapped = advanceVolatileTurn(applyResidualDamage(trapped).pokemon).pokemon;
      pulses += 1;
    }

    expect(hit.target.volatile.partialTrapTurns).toBe(5);
    expect(pulses).toBe(5);
    expect(hit.target.currentHp - trapped.currentHp).toBe(5 * Math.floor(target.maxHp / 8));
  });

  it('does not trap Ghost types and prevents a trapped Pokémon from switching', () => {
    const user = pokemon('torchic', 20, 'Fire Spin');
    const ghost = pokemon('phantump', 20, 'Splash');
    const ghostHit = executeMove(user, ghost, move('Fire Spin'), always(0));
    const battle = startWildBattle([pokemon('treecko', 20, 'Tackle'), pokemon('torchic', 20, 'Tackle')], ghost);
    const trapped = {
      ...battle,
      player: { ...battle.player, volatile: { ...battle.player.volatile, partialTrapTurns: 2 } },
      playerParty: battle.playerParty.map((member, index) => index === battle.playerActive
        ? { ...member, volatile: { ...member.volatile, partialTrapTurns: 2 } }
        : member),
    };
    const attempted = switchActivePokemon(trapped, 1, always(0.99));

    expect(ghostHit.target.volatile.partialTrapTurns).toBe(0);
    expect(attempted.playerActive).toBe(0);
    expect(attempted.log.some((line) => line.includes('preso'))).toBe(true);
  });

  it('passes stat stages and Substitute to the replacement', () => {
    const lead = pokemon('torchic', 20, 'Baton Pass');
    const reserve = pokemon('treecko', 20, 'Tackle');
    const battle = startWildBattle([lead, reserve], pokemon('wurmple', 20, 'Splash'));
    const prepared = {
      ...battle,
      player: {
        ...battle.player,
        stages: { ...battle.player.stages, atk: 2, spe: 1 },
        volatile: { ...battle.player.volatile, substituteHp: 12 },
        speed: 999,
      },
      playerParty: battle.playerParty.map((member, index) => index === battle.playerActive
        ? {
          ...member,
          stages: { ...member.stages, atk: 2, spe: 1 },
          volatile: { ...member.volatile, substituteHp: 12 },
          speed: 999,
        }
        : member),
    };
    const result = executeBattleTurn(prepared, 0, always(0.99));

    expect(result.playerActive).toBe(1);
    expect(result.player.stages).toMatchObject({ atk: 2, spe: 1 });
    expect(result.player.volatile.substituteHp).toBe(12);
    expect(result.playerParty[0]?.stages.atk).toBe(0);
  });
});

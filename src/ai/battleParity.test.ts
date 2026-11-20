import { describe, expect, it } from 'vitest';
import { calculateDamage, createPokemonInstance, executeBattleTurn, genSixCatchShakeThreshold, genSixCriticalCaptureOdds, startWildBattle } from '../core/battle';
import { applyEntryHazards, createBattleField, setEntryHazard } from '../core/battleField';
import { orderActions } from '../core/battleTurn';
import { toBattleMove } from '../core/battlePokemon';
import { getMoveByName, getSpeciesById } from '../core/dex';
import { applyResidualDamage, checkCanAct } from '../core/statusConditions';
import { executeMove } from '../core/moveExecution';

const alwaysMaxDamage = () => 1;

function pokemon(speciesId: string, level: number, moveName: string) {
  const species = getSpeciesById(speciesId);
  return createPokemonInstance(species, level, [getMoveByName(moveName).id]);
}

describe('Gen VI battle formula parity vectors', () => {
  it('matches the Gen VI damage vector for STAB, type effectiveness, weather and Blaze', () => {
    const torchic = pokemon('torchic', 30, 'Ember');
    const wurmple = pokemon('wurmple', 30, 'Tackle');
    const ember = toBattleMove(getMoveByName('Ember'));

    expect(calculateDamage(torchic, wurmple, ember, alwaysMaxDamage)).toBe(72);
    expect(calculateDamage(torchic, wurmple, ember, alwaysMaxDamage, { weather: 'sun' })).toBe(108);
    const blaze = { ...torchic, currentHp: Math.floor(torchic.maxHp / 3) };
    expect(calculateDamage(blaze, wurmple, ember, alwaysMaxDamage, { weather: 'sun' })).toBe(162);
  });

  it('matches deterministic damage vectors for new abilities and held-item modifiers', () => {
    const torchic = pokemon('torchic', 30, 'Scratch');
    const wurmple = pokemon('wurmple', 30, 'Tackle');
    const scratch = toBattleMove(getMoveByName('Scratch'));
    const emberUser = pokemon('torchic', 30, 'Ember');
    const ember = toBattleMove(getMoveByName('Ember'));
    const values = [
      calculateDamage({ ...torchic, ability: 'Technician' }, wurmple, scratch, alwaysMaxDamage),
      calculateDamage({ ...emberUser, ability: 'Adaptability' }, wurmple, ember, alwaysMaxDamage),
      calculateDamage({ ...torchic, heldItem: 'Choice Band' }, wurmple, scratch, alwaysMaxDamage),
      calculateDamage({ ...torchic, heldItem: 'Life Orb' }, wurmple, scratch, alwaysMaxDamage),
    ];

    expect(values).toEqual([28, 96, 28, 24]);
  });

  it('matches deterministic vectors for Sheer Force, contact damage, and partial trapping', () => {
    const torchic = pokemon('torchic', 30, 'Ember');
    const target = pokemon('wurmple', 60, 'Tackle');
    const ember = toBattleMove(getMoveByName('Ember'));
    const tackle = toBattleMove(getMoveByName('Tackle'));
    const contact = executeMove(torchic, { ...target, ability: 'Iron Barbs' }, tackle, () => 0.99);
    const bind = executeMove(torchic, target, toBattleMove(getMoveByName('Bind')), () => 0.5);
    const residual = applyResidualDamage(bind.target);
    const values = [
      calculateDamage(torchic, target, ember, alwaysMaxDamage),
      calculateDamage({ ...torchic, ability: 'Sheer Force' }, target, ember, alwaysMaxDamage),
      torchic.currentHp - contact.user.currentHp,
      bind.target.currentHp - residual.pokemon.currentHp,
    ];

    expect(values).toEqual([42, 54, 8, 15]);
  });

  it('matches deterministic Gen VI vectors for Knock Off, pivot attacks, and Sucker Punch', () => {
    const target = pokemon('wurmple', 30, 'Tackle');
    const knockOffUser = pokemon('torchic', 30, 'Knock Off');
    const knockOff = toBattleMove(getMoveByName('Knock Off'));
    const heldTarget = { ...target, heldItem: 'Leftovers' };
    const knockOffHeld = executeMove(knockOffUser, heldTarget, knockOff, alwaysMaxDamage);
    const knockOffEmpty = executeMove(knockOffUser, target, knockOff, alwaysMaxDamage);
    const uTurnUser = pokemon('torchic', 30, 'U-turn');
    const voltSwitchUser = pokemon('pikachu', 30, 'Volt Switch');
    const uTurn = executeMove(uTurnUser, target, toBattleMove(getMoveByName('U-turn')), alwaysMaxDamage);
    const voltSwitch = executeMove(voltSwitchUser, target, toBattleMove(getMoveByName('Volt Switch')), alwaysMaxDamage);
    const suckerTurn = executeBattleTurn(startWildBattle(pokemon('torchic', 30, 'Sucker Punch'), target), 0, alwaysMaxDamage);
    const values = [
      heldTarget.currentHp - knockOffHeld.target.currentHp,
      target.currentHp - knockOffEmpty.target.currentHp,
      target.currentHp - uTurn.target.currentHp,
      target.currentHp - voltSwitch.target.currentHp,
      target.currentHp - suckerTurn.enemy.currentHp,
    ];

    expect(knockOffHeld.target.heldItem).toBeNull();
    expect(uTurn.switchUser).toBe(true);
    expect(voltSwitch.switchUser).toBe(true);
    expect(values).toEqual([45, 30, 32, 46, 37]);
  });

  it('matches the Gen VI four-shake catch threshold for a full-health Poochyena', () => {
    const poochyena = pokemon('poochyena', 5, 'Tackle');

    expect(genSixCatchShakeThreshold(poochyena)).toBeCloseTo(53335.9083, 3);
    expect(genSixCatchShakeThreshold({ ...poochyena, currentHp: 1 })).toBeGreaterThan(
      genSixCatchShakeThreshold(poochyena)
    );
    expect(genSixCatchShakeThreshold({ ...poochyena, status: { kind: 'sleep', counter: 2 } })).toBeCloseTo(63333.4939, 3);
  });

  it('matches critical-capture byte thresholds for Pokédex progress', () => {
    const bulbasaur = pokemon('bulbasaur', 5, 'Tackle');

    expect(genSixCriticalCaptureOdds(bulbasaur, 30)).toBe(0);
    expect(genSixCriticalCaptureOdds(bulbasaur, 151)).toBe(2);
    expect(genSixCriticalCaptureOdds(bulbasaur, 601)).toBe(6);
  });

  it('matches the four-times Stealth Rock damage on a Charizard switch-in', () => {
    const charizard = pokemon('charizard', 50, 'Tackle');
    const field = setEntryHazard(createBattleField(), 'player', 'stealthRock').field;
    const entering = applyEntryHazards(field, 'player', charizard).pokemon;

    expect(entering.currentHp).toBe(charizard.currentHp - Math.floor(charizard.maxHp / 2));
  });

  it('matches a deterministic Gen VI 40-power confusion self-hit', () => {
    const torchic = pokemon('torchic', 30, 'Tackle');
    const confused = { ...torchic, volatile: { ...torchic.volatile, confusionTurns: 2 } };
    const rolls = [0, 1];
    const result = checkCanAct(confused, () => rolls.shift() ?? 1);

    expect(result.canAct).toBe(false);
    expect(result.pokemon.currentHp).toBe(torchic.currentHp - 17);
  });

  it('resolves +2 priority before a much faster −6 priority move', () => {
    const state = startWildBattle(pokemon('wurmple', 5, 'Extreme Speed'), pokemon('torchic', 5, 'Whirlwind'));
    const [first] = orderActions(
      state,
      { side: 'player', moveIndex: 0 },
      { side: 'enemy', moveIndex: 0 },
      () => 0.9
    );

    expect(first.side).toBe('player');
  });
});

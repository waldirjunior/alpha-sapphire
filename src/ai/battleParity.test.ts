import { describe, expect, it } from 'vitest';
import { calculateDamage, createPokemonInstance, genSixCatchShakeThreshold, startWildBattle } from '../core/battle';
import { orderActions } from '../core/battleTurn';
import { toBattleMove } from '../core/battlePokemon';
import { getMoveByName, getSpeciesById } from '../core/dex';

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

  it('matches the Gen VI four-shake catch threshold for a full-health Poochyena', () => {
    const poochyena = pokemon('poochyena', 5, 'Tackle');

    expect(genSixCatchShakeThreshold(poochyena)).toBeCloseTo(53335.9083, 3);
    expect(genSixCatchShakeThreshold({ ...poochyena, currentHp: 1 })).toBeGreaterThan(
      genSixCatchShakeThreshold(poochyena)
    );
    expect(genSixCatchShakeThreshold({ ...poochyena, status: { kind: 'sleep', counter: 2 } })).toBeCloseTo(63333.4939, 3);
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

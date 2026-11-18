import { describe, expect, it } from 'vitest';
import { createPokemonInstance, executeBattleTurn, startWildBattle } from './battle';
import { SPECIES } from '../data/pokemon/species';
import { toBattleMove } from './battlePokemon';
import { getMoveByName } from './dex';

describe('resolved battle events', () => {
  it('records the actual move, damage and faint in order without mutating the input', () => {
    const player = { ...createPokemonInstance(SPECIES.torchic, 50), moves: [toBattleMove(getMoveByName('Ember'))] };
    const enemy = createPokemonInstance(SPECIES.wurmple, 2);
    const before = startWildBattle(player, enemy);
    const after = executeBattleTurn(before, 0, () => 0.5);
    expect(after.events).toEqual([
      { type: 'move', side: 'player', category: 'special' },
      { type: 'damage', side: 'enemy' },
      { type: 'faint', side: 'enemy' },
    ]);
    expect(before.events).toBeUndefined();
  });
});

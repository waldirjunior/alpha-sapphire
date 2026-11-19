import { describe, expect, it } from 'vitest';
import { getSpeciesById } from '../core/dex';
import { createWildBattlePokemon } from './wildBattle';

describe('wild battle Pokémon generation', () => {
  it('rolls IVs and nature through the battle generator', () => {
    const pokemon = createWildBattlePokemon(getSpeciesById('poochyena'), 3, () => 0.999999);

    expect(pokemon.ivs).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
    expect(pokemon.nature).toBe(24);
    expect(pokemon.personality).toBeGreaterThan(0);
  });
});

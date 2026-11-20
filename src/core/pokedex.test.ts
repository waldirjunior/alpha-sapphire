import { describe, expect, it } from 'vitest';
import { createPokemonInstance } from './battle';
import { createPokedex, recordCaughtSpecies, recordEvolution, recordSeenSpecies } from './pokedex';
import { SPECIES } from '../data/pokemon/species';

describe('Pokédex state', () => {
  it('initializes seen and caught entries from the starting party without duplicates', () => {
    const torchic = createPokemonInstance(SPECIES.torchic, 5);
    const pokedex = createPokedex([torchic, { ...torchic, level: 6 }]);

    expect(pokedex).toEqual({ seenSpecies: ['torchic'], caughtSpecies: ['torchic'] });
  });

  it('records encounters as seen without mutating the previous state', () => {
    const initial = createPokedex([createPokemonInstance(SPECIES.torchic, 5)]);
    const seen = recordSeenSpecies(initial, 'poochyena');

    expect(seen).toEqual({ seenSpecies: ['torchic', 'poochyena'], caughtSpecies: ['torchic'] });
    expect(initial).toEqual({ seenSpecies: ['torchic'], caughtSpecies: ['torchic'] });
    expect(recordSeenSpecies(seen, 'poochyena')).toBe(seen);
  });

  it('records a capture as seen and caught exactly once', () => {
    const initial = createPokedex([createPokemonInstance(SPECIES.torchic, 5)]);
    const captured = recordCaughtSpecies(recordSeenSpecies(initial, 'poochyena'), 'poochyena');

    expect(captured).toEqual({ seenSpecies: ['torchic', 'poochyena'], caughtSpecies: ['torchic', 'poochyena'] });
    expect(recordCaughtSpecies(captured, 'poochyena')).toBe(captured);
  });

  it('records an evolved form as seen and caught while retaining the previous species', () => {
    const initial = createPokedex([createPokemonInstance(SPECIES.treecko, 16)]);

    expect(recordEvolution(initial, 'grovyle')).toEqual({
      seenSpecies: ['treecko', 'grovyle'],
      caughtSpecies: ['treecko', 'grovyle'],
    });
  });
});

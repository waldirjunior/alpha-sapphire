import { describe, expect, it } from 'vitest';
import { createInitialBag } from '../core/bag';
import { createPokemonInstance } from '../core/battle';
import { createPokedex } from '../core/pokedex';
import { createInitialState } from '../core/gameState';
import { SPECIES } from '../data/pokemon/species';
import { clearSavedGame, loadSavedGame, storeSavedGame } from './saveStorage';

describe('game save storage', () => {
  it('loads, stores, and clears the versioned game save through a storage port', () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      removeItem: (key: string) => { entries.delete(key); },
    };
    const save = {
      version: 1 as const,
      state: createInitialState('littleroot_town'),
      party: [createPokemonInstance(SPECIES.torchic, 5)],
      bag: createInitialBag(),
      caughtCount: 0,
      pokedex: createPokedex([createPokemonInstance(SPECIES.torchic, 5)]),
    };

    expect(loadSavedGame(storage, 'slot')).toBeNull();
    storeSavedGame(storage, 'slot', save);
    expect(loadSavedGame(storage, 'slot')).toEqual(save);
    clearSavedGame(storage, 'slot');
    expect(loadSavedGame(storage, 'slot')).toBeNull();
  });
});

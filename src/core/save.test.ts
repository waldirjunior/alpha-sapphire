import { describe, expect, it } from 'vitest';
import { createPokemonInstance } from './battle';
import { createInitialState } from './gameState';
import { SPECIES } from '../data/pokemon/species';
import { deserializeSave, serializeSave } from './save';

describe('save serialization', () => {
  it('round-trips game state, party, and caught count', () => {
    const state = createInitialState('route_101');
    const party = [
      createPokemonInstance(SPECIES.torchic, 5),
      createPokemonInstance(SPECIES.poochyena, 2),
    ];

    const raw = serializeSave({ version: 1, state, party, caughtCount: 1 });
    const loaded = deserializeSave(raw);

    expect(loaded).not.toBeNull();
    expect(loaded?.state.player.mapId).toBe('route_101');
    expect(loaded?.party.map((p) => p.species.id)).toEqual(['torchic', 'poochyena']);
    expect(loaded?.caughtCount).toBe(1);
  });

  it('returns null on corrupted or incompatible save payload', () => {
    expect(deserializeSave('not-json')).toBeNull();
    expect(deserializeSave(JSON.stringify({ version: 99 }))).toBeNull();
  });
});

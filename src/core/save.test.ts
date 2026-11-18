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

  it('restores numeric ROM flags and unsigned-16 works independently of manual story flags', () => {
    const state = { ...createInitialState('zone_0006'), romEvents: { flags: { 123: true }, vars: { 16384: 3 } } };
    const party = [createPokemonInstance(SPECIES.torchic, 5)];
    const loaded = deserializeSave(serializeSave({ version: 1, state, party, caughtCount: 0 }));
    expect(loaded?.state.romEvents).toEqual({ flags: { 123: true }, vars: { 16384: 3 } });
    expect(loaded?.state.storyFlags.starter_chosen).toBe(false);
  });

  it.each([null, [], { flags: {}, vars: [] }, { flags: { invalid: true }, vars: {} },
    { flags: { 1: 1 }, vars: {} }, { flags: {}, vars: { 16384: -1 } },
    { flags: {}, vars: { 16384: 65536 } }])('rejects invalid ROM event state: %j', romEvents => {
    const state = { ...createInitialState('zone_0006'), romEvents };
    const party = [createPokemonInstance(SPECIES.torchic, 5)];
    expect(deserializeSave(JSON.stringify({ version: 1, state, party, caughtCount: 0 }))).toBeNull();
  });

  it('returns null on corrupted or incompatible save payload', () => {
    expect(deserializeSave('not-json')).toBeNull();
    expect(deserializeSave(JSON.stringify({ version: 99 }))).toBeNull();
  });

  it('rejects pre-migration party members without PP or stat stages (A-012)', () => {
    const state = createInitialState('route_101');
    const legacy = {
      species: { id: 'torchic', baseStats: { hp: 45, attack: 60 } },
      level: 5,
      currentHp: 19,
      maxHp: 19,
      moves: [{ id: 'scratch', name: 'Scratch', power: 40 }],
    };
    expect(deserializeSave(JSON.stringify({ version: 1, state, party: [legacy], caughtCount: 0 }))).toBeNull();
  });
});

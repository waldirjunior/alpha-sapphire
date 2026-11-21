import { describe, expect, it } from 'vitest';
import { createPokemonInstance } from './battle';
import { createInitialState } from './gameState';
import { createPokedex } from './pokedex';
import { SPECIES } from '../data/pokemon/species';
import { deserializeSave, serializeSave } from './save';

describe('save serialization', () => {
  it.each([-1, 8, 0.5, '1', null])('rejects unsupported face expression %s from persisted state', expression => {
    const state = createInitialState('route_101');
    const invalid = { ...state, player: { ...state.player, faceExpression: expression } };
    const party = [createPokemonInstance(SPECIES.torchic, 5)];
    expect(deserializeSave(JSON.stringify({ version: 1, state: invalid, party, caughtCount: 0 }))).toBeNull();
  });

  it.each([0, 7])('round-trips supported face expression %s', faceExpression => {
    const state = createInitialState('route_101');
    state.player.faceExpression = faceExpression;
    const party = [createPokemonInstance(SPECIES.torchic, 5)];
    expect(deserializeSave(serializeSave({ version: 1, state, party, caughtCount: 0, pokedex: createPokedex(party) }))?.state.player.faceExpression)
      .toBe(faceExpression);
  });

  it('round-trips game state, party, and caught count', () => {
    const state = createInitialState('route_101');
    const party = [
      createPokemonInstance(SPECIES.torchic, 5),
      createPokemonInstance(SPECIES.poochyena, 2),
    ];

    const pokedex = { seenSpecies: ['torchic', 'poochyena'], caughtSpecies: ['torchic'] };
    const raw = serializeSave({ version: 1, state, party, caughtCount: 1, pokedex });
    const loaded = deserializeSave(raw);

    expect(loaded).not.toBeNull();
    expect(loaded?.state.player.mapId).toBe('route_101');
    expect(loaded?.party.map((p) => p.species.id)).toEqual(['torchic', 'poochyena']);
    expect(loaded?.caughtCount).toBe(1);
    expect(loaded?.pokedex).toEqual(pokedex);
  });

  it('migrates a saved bag without evolution items and round-trips the new inventory', () => {
    const state = createInitialState('route_101');
    const party = [createPokemonInstance(SPECIES.torchic, 5)];
    const legacy = deserializeSave(JSON.stringify({
      version: 1,
      state,
      party,
      bag: { pokeballs: 5, potions: 2, keyItems: [] },
      caughtCount: 0,
    }));

    expect(legacy?.bag?.evolutionItems).toEqual({});
    const saved = serializeSave({
      version: 1,
      state,
      party,
      bag: { pokeballs: 5, potions: 2, keyItems: [], evolutionItems: { 'Fire Stone': 2 } },
      caughtCount: 0,
      pokedex: createPokedex(party),
    });
    expect(deserializeSave(saved)?.bag?.evolutionItems).toEqual({ 'Fire Stone': 2 });
  });

  it('persists queued evolution move choices', () => {
    const state = createInitialState('route_101');
    const party = [createPokemonInstance(SPECIES.torchic, 5)];
    const loaded = deserializeSave(serializeSave({
      version: 1,
      state,
      party,
      caughtCount: 0,
      pokedex: createPokedex(party),
      pendingMoves: [{ partyIndex: 0, moveId: 1 }],
    }));

    expect(loaded?.pendingMoves).toEqual([{ partyIndex: 0, moveId: 1 }]);
  });

  it('backfills a Pokédex from the party when loading a legacy save', () => {
    const state = createInitialState('route_101');
    const party = [createPokemonInstance(SPECIES.torchic, 5)];
    const legacy = { version: 1, state, party, caughtCount: 3 };

    expect(deserializeSave(JSON.stringify(legacy))?.pokedex).toEqual({
      seenSpecies: ['torchic'],
      caughtSpecies: ['torchic'],
    });
  });

  it.each([{ seenSpecies: ['torchic'], caughtSpecies: 'torchic' }, { seenSpecies: [1], caughtSpecies: [] }])(
    'rejects malformed Pokédex state %j',
    pokedex => {
      const state = createInitialState('route_101');
      const party = [createPokemonInstance(SPECIES.torchic, 5)];
      expect(deserializeSave(JSON.stringify({ version: 1, state, party, caughtCount: 0, pokedex }))).toBeNull();
    },
  );

  it('persists the selected floor height and rejects a malformed height reference', () => {
    const state = createInitialState('route_101');
    state.player.groundY = 7.5;
    const party = [createPokemonInstance(SPECIES.torchic, 5)];
    expect(deserializeSave(serializeSave({ version: 1, state, party, caughtCount: 0, pokedex: createPokedex(party) }))?.state.player.groundY).toBe(7.5);
    const invalid = { ...state, player: { ...state.player, groundY: '7.5' } };
    expect(deserializeSave(JSON.stringify({ version: 1, state: invalid, party, caughtCount: 0 }))).toBeNull();
  });

  it('restores numeric ROM flags and unsigned-16 works independently of manual story flags', () => {
    const state = { ...createInitialState('zone_0006'), romEvents: { flags: { 123: true }, vars: { 16384: 3 } } };
    const party = [createPokemonInstance(SPECIES.torchic, 5)];
    const loaded = deserializeSave(serializeSave({ version: 1, state, party, caughtCount: 0, pokedex: createPokedex(party) }));
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

import { describe, expect, it, vi } from 'vitest';
import { encounterMethodForInput, directionForKey, hasSurfEncounterAccess, triggerEncounterForMethod } from './input';
import type { MapDefinition } from '../core/types';
import { createPokemonInstance, type BattleState } from '../core/battle';
import { createInitialState } from '../core/gameState';
import type { ZoneEncounterSource } from '../core/wildPokemon';
import { SPECIES } from '../data/pokemon/species';

describe('game input mapping', () => {
  it('maps arrows and WASD to the same grid directions', () => {
    expect(directionForKey('ArrowUp')).toBe('up');
    expect(directionForKey('KeyW')).toBe('up');
    expect(directionForKey('ArrowLeft')).toBe('left');
    expect(directionForKey('KeyD')).toBe('right');
  });

  it('ignores keys that do not move the player', () => {
    expect(directionForKey('Space')).toBeNull();
    expect(directionForKey('Escape')).toBeNull();
  });

  it('maps fishing, Rock Smash, and Horde shortcuts to their encounter methods', () => {
    expect(encounterMethodForInput('KeyF')).toBe('old_rod');
    expect(encounterMethodForInput('KeyF', true)).toBe('good_rod');
    expect(encounterMethodForInput('KeyF', false, true)).toBe('super_rod');
    expect(encounterMethodForInput('KeyR')).toBe('rock_smash');
    expect(encounterMethodForInput('KeyH')).toBe('horde_a');
    expect(encounterMethodForInput('KeyU')).toBe('surf');
    expect(encounterMethodForInput('KeyT')).toBe('tall_grass');
    expect(encounterMethodForInput('ArrowUp')).toBeNull();
  });

  it('allows Surf and fishing encounters only beside a Surf tile', () => {
    const map: MapDefinition = {
      id: 'route_101', name: 'Route 101', width: 4, height: 3,
      collisions: Array.from({ length: 3 }, () => Array(4).fill(0)),
      surfTiles: [{ x: 2, z: 1 }],
      warps: [],
    };
    expect(hasSurfEncounterAccess(map, { pos: { x: 1, z: 1 }, facing: 'right' })).toBe(true);
    expect(hasSurfEncounterAccess(map, { pos: { x: 1, z: 1 }, facing: 'left' })).toBe(false);
  });

  it('starts method-specific wild battles for Surf, fishing, Rock Smash, and Horde', () => {
    const encounters = Array.from({ length: 61 }, () => ({ species: 0, form: 0, levelMin: 0, levelMax: 0 }));
    encounters[27] = { species: 261, form: 0, levelMin: 3, levelMax: 3 };
    encounters[32] = { species: 263, form: 0, levelMin: 4, levelMax: 4 };
    encounters[37] = { species: 265, form: 0, levelMin: 5, levelMax: 5 };
    encounters[46] = { species: 261, form: 0, levelMin: 6, levelMax: 6 };
    const source: ZoneEncounterSource = {
      name: 'Route 101', encounterFormat: 'oras-61-slot-v1', encounters,
    };
    const map: MapDefinition = {
      id: 'route_101', name: 'Route 101', width: 4, height: 3,
      collisions: Array.from({ length: 3 }, () => Array(4).fill(0)),
      surfTiles: [{ x: 2, z: 1 }], encounters, encounterFormat: source.encounterFormat, warps: [],
    };
    const state = {
      ...createInitialState('route_101'),
      player: { ...createInitialState('route_101').player, pos: { x: 1, z: 1 }, facing: 'right' as const },
    };
    const battles: BattleState[] = [];
    const host = {
      maps: { route_101: map },
      getEncounterSources: () => ({ route_101: source }),
      getState: () => state,
      getBattle: () => battles[battles.length - 1] ?? null,
      setBattle: (battle: BattleState) => { battles.push(battle); },
      getParty: () => [createPokemonInstance(SPECIES.torchic, 5)],
      syncPartyFromBattle: () => {},
      renderBattle: () => {},
    };
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      triggerEncounterForMethod(host, 'surf');
      triggerEncounterForMethod(host, 'rock_smash');
      triggerEncounterForMethod(host, 'old_rod');
      triggerEncounterForMethod(host, 'horde_a');
    } finally {
      random.mockRestore();
    }

    expect(battles.map(battle => battle.enemy.species.id)).toEqual([
      'poochyena', 'zigzagoon', 'wurmple', 'poochyena',
    ]);
  });
});

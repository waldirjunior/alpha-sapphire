import { describe, expect, it } from 'vitest';
import { createAmxWorld } from '../core/amxMemory';
import {
  calculateDamage,
  createPokemonInstance,
  getTypeEffectiveness,
  rollWildEncounter,
} from '../core/battle';
import { createInitialState, isTallGrass, movePlayer } from '../core/gameState';
import type { Direction } from '../core/types';
import { MAPS } from '../data/maps';
import { ROUTE_101_ENCOUNTERS } from '../data/pokemon/route101';
import { MOVES, SPECIES } from '../data/pokemon/species';
import littlerootZoneSource from '../data/maps_v2/0006.json';
import { adaptZoneMap, type ZoneMapSource } from '../data/maps_v2/adapter';
import { projectEventActors } from '../engine/eventHost';
import littlerootTexts from '../data/texts/littleroot_town.json';
import oldaleTexts from '../data/texts/oldale_town.json';
import littlerootTrace from './traces/littleroot_movement.json';

describe('emulator parity suite (Alpha Sapphire Gen VI)', () => {
  it('matches Hoenn overworld route: Littleroot Town -> Route 101 -> Oldale Town', () => {
    let state = createInitialState('littleroot_town', MAPS);
    expect(state.player.pos).toEqual({ x: 20, z: 14 });

    const stepsToRoute101: Direction[] = Array(14).fill('up');
    for (const dir of stepsToRoute101) {
      state = movePlayer(state, dir, MAPS);
    }
    expect(state.player.mapId).toBe('route_101');
    expect(state.player.pos).toEqual({ x: 20, z: 38 });

    // Verifica que há grama alta real no caminho da Route 101
    expect(isTallGrass(MAPS.route_101, { x: 12, z: 25 })).toBe(true);

    // Posiciona na saída norte da Route 101 e cruza para Oldale Town
    state = {
      ...state,
      player: { ...state.player, pos: { x: 20, z: 1 } },
    };
    state = movePlayer(state, 'up', MAPS);
    expect(state.player.mapId).toBe('oldale_town');
    expect(state.player.pos).toEqual({ x: 20, z: 38 });

    // Posiciona na saída norte de Oldale Town e cruza para Route 103
    state = {
      ...state,
      player: { ...state.player, pos: { x: 20, z: 1 } },
    };
    state = movePlayer(state, 'up', MAPS);
    expect(state.player.mapId).toBe('route_103');
    expect(state.player.pos).toEqual({ x: 20, z: 38 });

    // Volta para Oldale Town e cruza para Route 102 pela saída oeste
    state = {
      ...state,
      player: { ...state.player, mapId: 'oldale_town', pos: { x: 2, z: 21 } },
    };
    state = movePlayer(state, 'left', MAPS);
    expect(state.player.mapId).toBe('route_102');
    expect(state.player.pos).toEqual({ x: 37, z: 21 });

    // Cruza Route 102 -> Route 102 (Oeste) -> Petalburg City
    state = {
      ...state,
      player: { ...state.player, pos: { x: 2, z: 16 } },
    };
    state = movePlayer(state, 'left', MAPS);
    expect(state.player.mapId).toBe('route_102_west');
    expect(state.player.pos).toEqual({ x: 37, z: 16 });

    state = {
      ...state,
      player: { ...state.player, pos: { x: 2, z: 16 } },
    };
    state = movePlayer(state, 'left', MAPS);
    expect(state.player.mapId).toBe('petalburg_city');
    expect(state.player.pos).toEqual({ x: 37, z: 16 });
  });

  it('matches Gen VI Lv.5 starter stats, type chart, and damage bounds', () => {
    const torchic = createPokemonInstance(SPECIES.torchic, 5);
    const treecko = createPokemonInstance(SPECIES.treecko, 5);
    const mudkip = createPokemonInstance(SPECIES.mudkip, 5);

    // Fórmula padrão Gen VI sem EVs/IVs (floor(2*Base*5/100)+5+10)
    expect(torchic.maxHp).toBe(19);
    expect(treecko.maxHp).toBe(19);
    expect(mudkip.maxHp).toBe(20);

    expect(getTypeEffectiveness('fire', ['bug'])).toBe(2);
    expect(getTypeEffectiveness('water', ['fire'])).toBe(2);
    expect(getTypeEffectiveness('grass', ['fire'])).toBe(0.5);

    const wurmple = createPokemonInstance(SPECIES.wurmple, 2);
    const minRoll = calculateDamage(torchic, wurmple, MOVES.ember, () => 0);
    const maxRoll = calculateDamage(torchic, wurmple, MOVES.ember, () => 1);
    expect(minRoll).toBeGreaterThanOrEqual(10);
    expect(maxRoll).toBeGreaterThanOrEqual(minRoll);

    const encounter = rollWildEncounter(ROUTE_101_ENCOUNTERS, () => 0.1, () => 0.2);
    expect(encounter?.speciesId).toBe('poochyena');
  });

  it('preserves canonical ROM slogans for Littleroot Town and Oldale Town', () => {
    expect(littlerootTexts.lines).toContain('Littleroot Town\n“A town that can’t be shaded any hue.”');
    expect(oldaleTexts.lines).toContain('Oldale Town\nWhere things start off scarce.');
  });

  it('matches recorded Azahar D-pad movement trace in Littleroot Town (zone_0006)', () => {
    const littleroot = adaptZoneMap(littlerootZoneSource as ZoneMapSource);
    const maps = { [littleroot.id]: littleroot };
    let state = {
      ...createInitialState(littleroot.id, maps),
      player: {
        id: 'local-player',
        mapId: littleroot.id,
        pos: { ...littlerootTrace.start },
        facing: 'down' as Direction,
      },
    };

    const distinctCells = [{ ...state.player.pos }];
    for (const step of littlerootTrace.steps) {
      state = movePlayer(state, step.direction as Direction, maps);
      expect(state.player.pos).toEqual(step.after);
      const last = distinctCells[distinctCells.length - 1];
      if (!last || last.x !== state.player.pos.x || last.z !== state.player.pos.z) {
        distinctCells.push({ ...state.player.pos });
      }
    }
    expect(distinctCells).toEqual(littlerootTrace.distinctCells);
  });

  it('documents spawnFlag=612 NPC visibility divergence observed in Azahar at (20, 15)', () => {
    const divergence = littlerootTrace.divergences[0];
    const baseMap = adaptZoneMap(littlerootZoneSource as ZoneMapSource);
    const blockedState = {
      ...createInitialState(baseMap.id, { [baseMap.id]: baseMap }),
      player: { id: 'local-player', mapId: baseMap.id, pos: { ...divergence.from }, facing: 'down' as Direction },
    };

    // Sem projectEventActors, zone_0006:npc:6 (spawnFlag=612) permanece visível e bloqueia (20,15).
    const unprojected = movePlayer(blockedState, divergence.direction as Direction, { [baseMap.id]: baseMap });
    expect(unprojected.player.pos).toEqual(divergence.from);

    // Quando a flag 612 do save pós-intro é aplicada, movePlayer iguala o traço livre observado no Azahar.
    const world = createAmxWorld(0, 6);
    world.flags[612] = true;
    const projectedMap = projectEventActors(baseMap, world);
    const projected = movePlayer(blockedState, divergence.direction as Direction, { [projectedMap.id]: projectedMap });
    expect(projected.player.pos).toEqual(divergence.emulatorCell);
  });
});

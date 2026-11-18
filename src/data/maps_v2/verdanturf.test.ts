import { expect, it } from 'vitest';
import { createInitialState, movePlayer } from '../../core/gameState';
import type { Direction, GameState, MapDefinition } from '../../core/types';
import { getZoneMap } from './loader';
import { createAmxWorld } from '../../core/amxMemory';
import { amxFlagKey, restoreAmxProgress } from '../../core/amxProgress';
import { projectEventActors } from '../../engine/eventHost';
import { worldPosition } from '../../core/boundaries';
import rustboro from '../zones/016_rustboro_city.json';
import route from '../zones/043_route_116.json';
import tunnel from '../zones/075_rusturf_tunnel.json';
import verdanturf from '../zones/011_verdanturf_town.json';

function reachZone(start: GameState, target: string, maps: Record<string, MapDefinition>): GameState | undefined {
  const key = (state: GameState) => `${state.player.mapId}:${state.player.pos.x}:${state.player.pos.z}`;
  const queue = [start], seen = new Set([key(start)]);
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  for (let index = 0; index < queue.length; index++) {
    const state = queue[index];
    if (state.player.mapId === target) return state;
    for (const direction of directions) {
      const next = movePlayer(state, direction, maps);
      if (seen.has(key(next)) || ![start.player.mapId, target].includes(next.player.mapId)) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
}

it('uses exactly the native encounters of all four corridor zones', async () => {
  const maps = await Promise.all([16, 43, 75, 11].map(getZoneMap));
  expect(maps.map(map => map.encounters)).toEqual([rustboro, route, tunnel, verdanturf].map(zone => zone.encounters));
});

it('crosses all seven native MM4 lanes in both directions with unit world steps', async () => {
  const zones = await Promise.all([16, 43].map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, map]));
  expect(maps.zone_0016.boundaries?.find(edge => edge.targetMapId === 'zone_0043')?.inferred).toBe(false);
  for (const z of [10, 11, 12, 13, 14, 15, 16]) {
    const state = createInitialState('zone_0016', maps);
    state.player.pos = { x: 79, z };
    const next = movePlayer(state, 'right', maps);
    expect(next.player).toMatchObject({ mapId: 'zone_0043', pos: { x: 0, z }, facing: 'right' });
    const before = worldPosition(state.player.pos, maps.zone_0016);
    expect(worldPosition(next.player.pos, maps.zone_0043)).toEqual({ x: before.x + 1, z: before.z });
    expect(movePlayer(next, 'left', maps).player).toMatchObject({ mapId: 'zone_0016', pos: { x: 79, z }, facing: 'left' });
  }
});

it('preserves the real cave portals, their arrival positions and facing without inferred edges', async () => {
  const zones = await Promise.all([43, 75, 11].map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, map]));
  const entry = createInitialState('zone_0043', maps);
  entry.player.pos = { x: 62, z: 11 };
  expect(movePlayer(entry, 'up', maps).player).toMatchObject({ mapId: 'zone_0075', pos: { x: 14, z: 20 }, facing: 'up' });
  const exit = createInitialState('zone_0075', maps);
  exit.player.pos = { x: 59, z: 26 };
  const town = movePlayer(exit, 'down', maps);
  expect(town.player).toMatchObject({ mapId: 'zone_0011', pos: { x: 16, z: 7 }, facing: 'down' });
  town.player.pos = { x: 16, z: 8 };
  expect(movePlayer(town, 'up', maps).player).toMatchObject({ mapId: 'zone_0075', pos: { x: 59, z: 27 }, facing: 'up' });
  expect(maps.zone_0075.boundaries?.length ?? 0).toBe(0);
  expect(maps.zone_0043.boundaries?.some(edge => edge.targetMapId === 'zone_0075')).toBe(false);
});

it('opens the tunnel through the real hide-flag projection using an explicit post-event fixture', async () => {
  const zones = await Promise.all([16, 43, 75, 11].map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, map]));
  let state = createInitialState('zone_0016', maps);
  state.player.pos = { x: 47, z: 65 };
  state.storyFlags[amxFlagKey(676)] = true;
  const world = restoreAmxProgress(createAmxWorld(0, 75), state.storyFlags);
  maps.zone_0075 = projectEventActors(maps.zone_0075, world);
  for (const target of ['zone_0043', 'zone_0075', 'zone_0011']) {
    const next = reachZone(state, target, maps);
    expect(next, `No path to ${target} after native flag676`).toBeDefined();
    if (!next) return;
    state = next;
  }
  expect(state.player.mapId).toBe('zone_0011');
});

it('keeps the initial tunnel blocked with all native collisions and NPCs intact', async () => {
  const zones = await Promise.all([16, 43, 75, 11].map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, map]));
  let state = createInitialState('zone_0016', maps);
  state.player.pos = { x: 47, z: 65 };
  for (const target of ['zone_0043', 'zone_0075']) {
    const next = reachZone(state, target, maps);
    expect(next, `No native walkable path to ${target}`).toBeDefined();
    if (!next) return;
    state = next;
  }
  expect(state.player.mapId).toBe('zone_0075');
  expect(reachZone(state, 'zone_0011', maps)).toBeUndefined();
});

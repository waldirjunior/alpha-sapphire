import { describe, expect, it } from 'vitest';
import { createInitialState, isWalkable, movePlayer } from '../../core/gameState';
import { worldPosition } from '../../core/boundaries';
import { stepWarp } from '../../core/warps';
import type { Direction, GameState, MapDefinition } from '../../core/types';
import { getZoneMap } from './loader';
import petalburg from '../zones/013_petalburg_city.json';
import rustboro from '../zones/016_rustboro_city.json';
import northRoute from '../zones/026_route_104.json';
import southRoute from '../zones/027_route_104.json';
import woods from '../zones/082_petalburg_woods.json';

const corridor = () => Promise.all([13, 27, 82, 26, 16].map(getZoneMap));

function pathToZone(start: GameState, target: string, maps: Record<string, MapDefinition>): GameState | undefined {
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

describe('Petalburg to Rustboro corridor', () => {
  it('preserves all five inferred bridge lanes in both directions without reentering its coincident warp', async () => {
    const zones = await corridor(), maps = Object.fromEntries(zones.map(map => [map.id, map]));
    for (const z of [46, 47, 48, 49, 50]) {
      const start = createInitialState('zone_0013', maps);
      start.player.pos = { x: 1, z };
      expect(stepWarp(start, 'left', maps.zone_0013)).toBeUndefined();
      const next = movePlayer(start, 'left', maps);
      expect(next.player).toMatchObject({ mapId: 'zone_0027', pos: { x: 76, z }, facing: 'left' });
      const before = worldPosition(start.player.pos, maps.zone_0013);
      expect(worldPosition(next.player.pos, maps.zone_0027)).toEqual({ x: before.x - 1, z: before.z });
      expect(movePlayer(next, 'right', maps).player).toMatchObject({ mapId: 'zone_0013', pos: { x: 1, z }, facing: 'right' });
      expect(movePlayer(next, 'left', maps).player.mapId).toBe('zone_0027');
    }
    expect(maps.zone_0013.boundaries?.find(edge => edge.targetMapId === 'zone_0027')?.inferred).toBe(true);
  });

  it('uses the exact native encounter tables for all five zones', async () => {
    const zones = await corridor();
    expect(zones.map(map => map.encounters)).toEqual([petalburg, southRoute, woods, northRoute, rustboro].map(zone => zone.encounters));
  });

  it('keeps a visible arrival NPC blocking regardless of its nonzero spawnFlag', async () => {
    const zones = await corridor(), maps = Object.fromEntries(zones.map(map => [map.id, map]));
    const state = createInitialState('zone_0013', maps);
    state.player.pos = { x: 1, z: 48 };
    const npc = { id: 'synthetic-arrival', pos: { x: 76, z: 48 }, modelUrl: '', model: 0, script: 0, spawnFlag: 623 };
    const route = { ...maps.zone_0027, npcs: [npc] };
    expect(movePlayer(state, 'left', { ...maps, zone_0027: route }).player.mapId).toBe('zone_0013');
    const hidden = { ...route, npcs: [{ ...npc, visible: false }] };
    expect(movePlayer(state, 'left', { ...maps, zone_0027: hidden }).player.mapId).toBe('zone_0027');
  });

  it('walks the native forest portals and MM4 boundary with all source NPC blockers intact', async () => {
    const zones = await corridor(), maps = Object.fromEntries(zones.map(map => [map.id, map]));
    let state = createInitialState('zone_0013', maps);
    state.player.pos = { x: 39, z: 54 };
    for (const target of ['zone_0027', 'zone_0082', 'zone_0026', 'zone_0016']) {
      const next = pathToZone(state, target, maps);
      expect(next, `No walkable path from ${state.player.mapId} to ${target}`).toBeDefined();
      if (!next) return;
      state = next;
    }
    expect(state.player.mapId).toBe('zone_0016');
    expect(isWalkable(maps.zone_0016, state.player.pos)).toBe(true);
    expect(maps.zone_0026.boundaries?.find(edge => edge.targetMapId === 'zone_0016')?.inferred).toBe(false);
    expect(maps.zone_0027.boundaries?.some(edge => edge.targetMapId === 'zone_0082')).toBeFalsy();
  });
});

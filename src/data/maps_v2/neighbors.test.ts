import { expect, it } from 'vitest';
import { createInitialState, movePlayer } from '../../core/gameState';
import { worldPosition } from '../../core/boundaries';
import { getZoneMap } from './loader';
import nativeRoute from '../zones/023_route_101.json';

it('connects the corridor with unit world steps and reads the exact native zone encounters', async () => {
  const zones = await Promise.all([6, 23, 7, 24, 13].map(getZoneMap));
  const maps = Object.fromEntries(zones.map((map) => [map.id, map]));
  const cases = [
    { zone: 6, pos: { x: 20, z: 0 }, direction: 'up', target: 23 },
    { zone: 23, pos: { x: 20, z: 0 }, direction: 'up', target: 7 },
    { zone: 7, pos: { x: 1, z: 21 }, direction: 'left', target: 24 },
    { zone: 24, pos: { x: 0, z: 16 }, direction: 'left', target: 13 },
  ] as const;
  for (const entry of cases) {
    const state = createInitialState(`zone_${String(entry.zone).padStart(4, '0')}`, maps);
    state.player.pos = { ...entry.pos };
    const start = worldPosition(state.player.pos, maps[state.player.mapId]);
    const next = movePlayer(state, entry.direction, maps);
    expect(next.player.mapId).toBe(`zone_${String(entry.target).padStart(4, '0')}`);
    const end = worldPosition(next.player.pos, maps[next.player.mapId]);
    expect(Math.abs(end.x - start.x) + Math.abs(end.z - start.z)).toBe(1);
  }
  expect(maps.zone_0023.encounters).toEqual(nativeRoute.encounters);
  expect(maps.zone_0007.boundaries?.find((edge) => edge.targetMapId === 'zone_0024')?.inferred).toBe(true);
});

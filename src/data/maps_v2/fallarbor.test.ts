import { expect, it } from 'vitest';
import { createInitialState, movePlayer } from '../../core/gameState';
import type { Direction, GameState, GridPosition, MapDefinition } from '../../core/types';
import { createAmxWorld } from '../../core/amxMemory';
import { persistAmxProgress, restoreAmxProgress } from '../../core/amxProgress';
import { projectEventActors } from '../../engine/eventHost';
import { getZoneMap } from './loader';
import rockScript from '../zone_scripts/global_0046.json';
import meteorSource from './0071.json';
import route111 from '../zones/037_route_111.json';
import route112South from '../zones/039_route_112.json';
import fiery from '../zones/085_fiery_path.json';
import route112North from '../zones/038_route_112.json';
import route111North from '../zones/036_route_111.json';
import route113 from '../zones/040_route_113.json';
import fallarbor from '../zones/010_fallarbor_town.json';
import route114 from '../zones/041_route_114.json';
import meteor from '../zones/071_meteor_falls.json';
import route115 from '../zones/042_route_115.json';

const corridor = [15, 445, 37, 39, 85, 38, 36, 40, 10, 41, 71, 42, 16];

function reachZone(start: GameState, target: string, maps: Record<string, MapDefinition>, point?: GridPosition): GameState | undefined {
  const key = (state: GameState) => `${state.player.mapId}:${state.player.pos.x}:${state.player.pos.z}`;
  const queue = [start], seen = new Set([key(start)]);
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  for (let index = 0; index < queue.length; index++) {
    const state = queue[index];
    if (state.player.mapId === target && (!point || state.player.pos.x === point.x && state.player.pos.z === point.z)) return state;
    for (const direction of directions) {
      const next = movePlayer(state, direction, maps);
      if (seen.has(key(next)) || ![start.player.mapId, target].includes(next.player.mapId)) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
}

function staticCalls(entry: number): Set<number> {
  const queue = [entry], seen = new Set<number>();
  for (let index = 0; index < queue.length; index++) {
    const start = queue[index];
    if (seen.has(start)) continue;
    seen.add(start);
    const end = rockScript.functions.find(offset => offset > start) ?? Infinity;
    for (const row of rockScript.instructions) {
      if (row.offset >= start && row.offset < end && row.mnemonic === 'call' && row.target !== undefined) queue.push(row.target);
    }
  }
  return seen;
}

it('keeps the four Route111 field objects blocking the northern path in base state', async () => {
  const zones = await Promise.all(corridor.map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, map]));
  let state = createInitialState('zone_0015', maps);
  state.player.pos = { x: 17, z: 22 };
  for (const target of ['zone_0445', 'zone_0037']) {
    const next = reachZone(state, target, maps);
    expect(next, target).toBeDefined();
    if (!next) return;
    state = next;
  }
  expect(reachZone(state, 'zone_0039', maps)).toBeUndefined();
  const gate = reachZone(state, 'zone_0037', maps, { x: 31, z: 66 });
  expect(gate).toBeDefined();
  if (!gate) return;
  expect(maps.zone_0037.collisions[65][31]).toBe(0);
  expect(movePlayer(gate, 'up', maps).player.pos).toEqual(gate.player.pos);
  expect(maps.zone_0037.npcs?.filter(npc => npc.script === 10050).map(npc => ({ id: npc.id, flag: npc.spawnFlag, model: npc.model })))
    .toEqual([2, 3, 4, 5].map(id => ({ id: `zone_0037:npc:${id}`, flag: 0, model: 8204 })));
});

it('walks only a derived post-RockSmash fixture through Fallarbor to the actual Meteor Falls entrance', async () => {
  const zones = await Promise.all(corridor.map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, map]));
  const start = createInitialState('zone_0037', maps);
  start.player.pos = { x: 31, z: 66 };
  const fixture = createAmxWorld(0, 37);
  for (const id of [2, 3, 4, 5]) fixture.deletedActors[`37:${id}`] = true;
  const saved = persistAmxProgress(start, fixture);
  const restored = restoreAmxProgress(createAmxWorld(0, 37), saved.storyFlags);
  const projected = projectEventActors(maps.zone_0037, restored);
  const fixtureMaps = { ...maps, zone_0037: projected };
  expect(projected.npcs?.filter(npc => npc.visible === false).map(npc => npc.id)).toEqual([2, 3, 4, 5].map(id => `zone_0037:npc:${id}`));
  expect(saved.player).toEqual(start.player);
  expect(restored.flags).toEqual({});
  expect(maps.zone_0037.npcs?.every(npc => npc.visible !== false)).toBe(true);
  expect(start.storyFlags).not.toHaveProperty('amx:deleted:37:2');
  let state = saved;
  for (const target of ['zone_0039', 'zone_0085', 'zone_0038', 'zone_0036', 'zone_0040', 'zone_0010', 'zone_0041', 'zone_0071']) {
    const next = reachZone(state, target, fixtureMaps);
    expect(next, `Missing derived-fixture path ${state.player.mapId} -> ${target}`).toBeDefined();
    if (!next) return;
    state = next;
  }
  expect(state.player).toMatchObject({ mapId: 'zone_0071', pos: { x: 57, z: 35 }, facing: 'up' });
  expect(reachZone(state, 'zone_0042', fixtureMaps)).toBeUndefined();
});

it('does not mistake the Meteor Falls entrance component for a route to every floor or Route115', async () => {
  const zones = await Promise.all([71, 72, 73, 42].map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, { ...map, npcs: [] }]));
  const state = createInitialState('zone_0071', maps);
  state.player.pos = { x: 57, z: 35 };
  for (const target of ['zone_0072', 'zone_0073', 'zone_0042']) expect(reachZone(state, target, maps), target).toBeUndefined();
  expect(meteorSource.warps.filter(warp => ['zone_0041', 'zone_0042'].includes(warp.targetMapId)).map(warp => warp.rom.z)).toEqual([54, -126]);
  expect(meteorSource.source.chunks.map(chunk => chunk.grId)).toEqual([260, 261, 262, 263]);
  expect(maps.zone_0071.boundaries?.length ?? 0).toBe(0);
});

it('separates native RockSmash calls from unproved per-object persistence and unrelated flag writes', () => {
  expect(rockScript.sha256).toBe('c63af4251dc7406fd89126af85cbef598c889312f303d117b51ba7547c50a362');
  expect(rockScript.dispatch.caseCalls['10050']).toEqual([5324]);
  expect(rockScript.dispatch.caseCalls['10051']).toEqual([5480]);
  const reachable = staticCalls(5324);
  expect(reachable.size).toBe(29);
  expect(reachable.has(3984)).toBe(true);
  expect(reachable.has(5480)).toBe(false);
  const nativeCalls = rockScript.instructions.filter(row => row.native?.name);
  expect(nativeCalls.filter(row => row.native?.name === 'CallIwakudakiEffect').map(row => row.offset)).toEqual([4276, 5576]);
  expect(nativeCalls.filter(row => row.native?.name === 'MdlDel')).toEqual([]);
  const writes = nativeCalls.filter(row => row.native?.name === 'FlagSet');
  expect(writes.map(row => row.offset)).toEqual([6792, 7208]);
  for (const row of writes) expect(reachable.has([...rockScript.functions].reverse().find(offset => offset <= row.offset) ?? -1)).toBe(false);
});

it('preserves intra-MM contacts, impassable cliff contacts and the native encounter tables', async () => {
  const zones = await Promise.all(corridor.map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, map]));
  for (const [from, to] of [[37, 39], [38, 36], [36, 40], [40, 10], [10, 41], [42, 16]]) {
    expect(maps[`zone_${String(from).padStart(4, '0')}`].boundaries?.find(edge => edge.targetMapId === `zone_${String(to).padStart(4, '0')}`)).toHaveProperty('inferred', false);
  }
  const state = createInitialState('zone_0038', maps);
  state.player.pos = { x: 7, z: 17 };
  expect(reachZone(state, 'zone_0040', maps)).toBeUndefined();
  expect(reachZone(state, 'zone_0036', maps)).toBeDefined();
  const sources = [route111, route112South, fiery, route112North, route111North, route113, fallarbor, route114, meteor, route115];
  const ids = [37, 39, 85, 38, 36, 40, 10, 41, 71, 42];
  expect(ids.map(id => maps[`zone_${String(id).padStart(4, '0')}`].encounters)).toEqual(sources.map(zone => zone.encounters));
});

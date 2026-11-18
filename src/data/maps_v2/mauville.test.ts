import { expect, it } from 'vitest';
import { createInitialState, movePlayer } from '../../core/gameState';
import type { Direction, GameState, MapDefinition } from '../../core/types';
import { getZoneMap } from './loader';
import { createAmxWorld } from '../../core/amxMemory';
import { createAmxState, runAmx } from '../../core/amxRunner';
import type { AmxBundle, AmxInstruction } from '../../core/amxTypes';
import { persistAmxProgress, restoreAmxProgress } from '../../core/amxProgress';
import { projectEventActors } from '../../engine/eventHost';
import routeScript from '../zone_scripts/0033.json';
import verdanturf from '../zones/011_verdanturf_town.json';
import route117 from '../zones/044_route_117.json';
import mauvilleHall from '../zones/445_mauville_city.json';
import mauvilleCourtyard from '../zones/015_mauville_city.json';
import route110 from '../zones/033_route_110.json';
import slateport from '../zones/014_slateport_city.json';

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

it('walks Verdanturf, Route117 and the real Mauville hall before its courtyard without hiding actors', async () => {
  const zones = await Promise.all([11, 44, 445, 15, 33, 14].map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, map]));
  let state = createInitialState('zone_0011', maps);
  state.player.pos = { x: 16, z: 22 };
  for (const target of ['zone_0044', 'zone_0445', 'zone_0015', 'zone_0445', 'zone_0033']) {
    const next = reachZone(state, target, maps);
    expect(next, `Native path missing ${state.player.mapId} -> ${target}`).toBeDefined();
    if (!next) return;
    state = next;
  }
  expect(state.player.mapId).toBe('zone_0033');
  expect(reachZone(state, 'zone_0014', maps)).toBeUndefined();
  expect(state.storyFlags).not.toHaveProperty('amx:flag:660');
  expect(zones.flatMap(map => map.npcs ?? []).every(npc => npc.visible !== false)).toBe(true);
});

it('opens only the five native Route110 blockers with the real post-event block and preserves their source data', async () => {
  const zones = await Promise.all([33, 14].map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, map]));
  const world = createAmxWorld(0, 33);
  for (const id of [9, 10, 11, 12, 13]) world.actors[id] = { x: 16, y: 0, z: 116, direction: 0, visible: true, moveCode: 0 };
  const instructions: AmxInstruction[] = routeScript.programs.map.instructions.filter(row => row.offset >= 7360 && row.offset < 7476);
  const bundle: AmxBundle = { departure: { data: [0], stackTop: 4096,
    program: { entryPoint: 7360, dispatch: null, instructions: [...instructions,
      { offset: 7476, size: 8, mnemonic: 'halt', operands: [0] }] } } };
  expect(routeScript.programs.map.sha256).toBe('9492e0f2e9f8bfef75e6657ffa991d3fbbc97ec101ace80b69cc550b062f4ef6');
  const result = runAmx(bundle, createAmxState(bundle, 'departure', 0, world));
  expect(result.status).toBe('completed');
  expect(result.world.vars[16526]).toBe(2);
  expect(result.world.flags[660]).toBe(true);
  expect(result.world.deletedActors).toEqual({ '33:9': true, '33:10': true, '33:11': true, '33:12': true, '33:13': true });
  expect(result.world.actors).toEqual({});
  expect(result.world.effects).toEqual([]);
  const start = createInitialState('zone_0033', maps);
  start.player.pos = { x: 27, z: 9 };
  const saved = persistAmxProgress({ ...start, romEvents: { flags: result.world.flags, vars: result.world.vars } }, result.world);
  const restored = restoreAmxProgress({ ...createAmxWorld(0, 33),
    flags: { ...saved.romEvents?.flags }, vars: { ...saved.romEvents?.vars } }, saved.storyFlags);
  expect(restored.vars[16526]).toBe(2);
  const projected = projectEventActors(maps.zone_0033, restored);
  expect(projected.npcs?.filter(npc => npc.visible === false).map(npc => npc.id)).toEqual([9, 10, 11, 12, 13].map(id => `zone_0033:npc:${id}`));
  expect(reachZone(saved, 'zone_0014', { ...maps, zone_0033: projected })?.player).toMatchObject({ mapId: 'zone_0014', pos: { x: 31, z: 1 }, facing: 'down' });
  expect(maps.zone_0033.npcs?.every(npc => npc.visible !== false)).toBe(true);
  expect(start.storyFlags).not.toHaveProperty('amx:flag:660');
  expect(world.actors[9]).toBeDefined();
});

it('keeps the actual hall/courtyard portals and unequal Route110/Slateport rectangles instead of inventing edges', async () => {
  const zones = await Promise.all([11, 44, 445, 15, 33, 14].map(getZoneMap));
  const maps = Object.fromEntries(zones.map(map => [map.id, map]));
  expect(maps.zone_0011.boundaries?.find(edge => edge.targetMapId === 'zone_0044')).toMatchObject({ direction: 'right', length: 40, inferred: false });
  expect(maps.zone_0044.warps.find(warp => warp.targetMapId === 'zone_0445')).toMatchObject({ from: { x: 77, z: 20 }, targetPos: { x: 22, z: 61 }, width: 1, height: 5 });
  expect(maps.zone_0445.warps.filter(warp => warp.targetMapId === 'zone_0015')).toHaveLength(4);
  expect(maps.zone_0033.warps.find(warp => warp.targetMapId === 'zone_0014')).toMatchObject({ from: { x: 33, z: 155 }, targetPos: { x: 31, z: 1 }, width: 5, height: 1 });
  expect(maps.zone_0014.warps.find(warp => warp.targetMapId === 'zone_0033')).toMatchObject({ from: { x: 31, z: 1 }, targetPos: { x: 33, z: 155 }, width: 3, height: 1 });
  expect(maps.zone_0033.boundaries?.length ?? 0).toBe(0);
  expect(maps.zone_0445.boundaries?.length ?? 0).toBe(0);
});

it('uses exactly the native tables of the hall, courtyard and both outdoor routes', async () => {
  const maps = await Promise.all([11, 44, 445, 15, 33, 14].map(getZoneMap));
  expect(maps.map(map => map.encounters)).toEqual([verdanturf, route117, mauvilleHall, mauvilleCourtyard, route110, slateport].map(zone => zone.encounters));
});

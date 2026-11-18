import { expect, it } from 'vitest';
import { createInitialState, movePlayer } from '../../core/gameState';
import { createAmxWorld } from '../../core/amxMemory';
import { createAmxState, runAmx } from '../../core/amxRunner';
import type { AmxBundle, AmxProgram, AmxWorld } from '../../core/amxTypes';
import type { Direction, GameState, MapDefinition } from '../../core/types';
import { projectEventActors } from '../../engine/eventHost';
import { decodeEventWarp, eventWarpState } from '../../engine/eventWarp';
import meteorEvent from '../zone_scripts/global_0028.json';
import lowerStation from '../zone_scripts/0384.json';
import upperStation from '../zone_scripts/0385.json';
import { getZoneMap } from './loader';

async function zoneMaps(zones: number[]): Promise<Record<string, MapDefinition>> {
  return Object.fromEntries((await Promise.all(zones.map(getZoneMap))).map(map => [map.id, map]));
}

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

function realSlice(source: AmxProgram, start: number, end: number, world: AmxWorld, mapChangeHelper = false) {
  const instructions = source.instructions.filter(row => (row.offset >= start && row.offset < end) ||
    (mapChangeHelper && row.offset >= 2904 && row.offset < 2964));
  const bundle: AmxBundle = { fixture: { data: [0], stackTop: 4096,
    program: { entryPoint: start, dispatch: null, instructions: [...instructions,
      { offset: end, size: 8, mnemonic: 'halt', operands: [0] }] } } };
  return runAmx(bundle, createAmxState(bundle, 'fixture', 0, world));
}

function postDemoFixture(source: AmxProgram, world: AmxWorld, work: number, warpStart: number, warpEnd: number) {
  const prepared = realSlice(source, work, work + 20, world);
  expect(prepared.status).toBe('completed');
  expect(prepared.world.vars).toEqual({ 16699: 1 });
  const travel = realSlice(source, warpStart, warpEnd, prepared.world, true);
  if (travel.awaiting?.kind !== 'native') throw new Error('Post-demo fixture must pause on the native map change');
  expect(travel.awaiting.effect.name).toBe('_MapChangeCore');
  return { world: travel.world, effect: travel.awaiting.effect };
}

function upperArrival(world: AmxWorld, map: MapDefinition): MapDefinition {
  const seeded = { ...world, zoneId: 385, actors: { 1: {
    x: 21, y: 0, z: 26, direction: 0, visible: true, moveCode: 0,
  } } };
  const bundle: AmxBundle = { arrival: { data: [0], stackTop: 4096, program: upperStation.programs.entities } };
  const result = runAmx(bundle, createAmxState(bundle, 'arrival', 1, seeded));
  expect(result.status).toBe('completed');
  expect(result.world.actors[1]).toMatchObject({ x: 24, y: 57, z: 18, visible: true });
  expect(result.world.deletedActors).toEqual({});
  return projectEventActors(map, result.world);
}

it('preserves the station ZO exits instead of inventing a cable-car portal', async () => {
  const maps = await zoneMaps([39, 384, 385, 83, 84, 9]);
  expect(maps.zone_0039.warps).toContainEqual(expect.objectContaining({ from: { x: 58, z: 23 },
    targetMapId: 'zone_0384', targetPos: { x: 15, z: 28 } }));
  expect(maps.zone_0384.warps.map(w => w.targetMapId)).toEqual(['zone_0039']);
  expect(maps.zone_0385.warps.map(w => w.targetMapId)).toEqual(['zone_0083']);
  expect(maps.zone_0083.warps.map(w => w.targetMapId)).toContain('zone_0084');
  expect(maps.zone_0039.boundaries).toContainEqual(expect.objectContaining({ targetMapId: 'zone_0009', inferred: false }));
});

it('keeps the Route112 station blocked before the real flag666 progress slice', async () => {
  const maps = await zoneMaps([39, 384]);
  const state = createInitialState('zone_0039', maps);
  state.player.pos = { x: 79, z: 65 };
  expect(maps.zone_0039.npcs?.filter(n => n.spawnFlag === 666).map(n => n.id)).toEqual(
    ['zone_0039:npc:0', 'zone_0039:npc:1', 'zone_0039:npc:2']);
  expect(reachZone(state, 'zone_0384', maps)).toBeUndefined();
  const result = realSlice(meteorEvent, 21800, 21816, createAmxWorld(0, 39));
  expect(meteorEvent.sha256).toBe('559ded787a493cc8943fc25f2ba3905bdf35a4122c149a8286c173444d529448');
  expect(result.world.flags).toEqual({ 666: true });
  expect(result.world.deletedActors).toEqual({});
  const projected = { ...maps, zone_0039: projectEventActors(maps.zone_0039, result.world) };
  expect(projected.zone_0039.npcs?.filter(n => n.visible === false).map(n => n.id)).toEqual(
    ['zone_0039:npc:0', 'zone_0039:npc:1', 'zone_0039:npc:2']);
  expect(reachZone(state, 'zone_0384', projected)).toBeDefined();
});

it('executes explicitly bounded post-demo transport cells in both directions, without simulating the movie', () => {
  const up = postDemoFixture(lowerStation.programs.map, createAmxWorld(0, 384), 4124, 4220, 4256);
  expect(up.effect.args).toEqual([385, 23, 57, 18, 1, 0, 0, 1, 0]);
  expect(decodeEventWarp(up.effect.args)).toEqual({ zoneId: 385, pos: { x: 23, z: 18 }, height: 57,
    facing: 'up', flags: [false, false, true, false] });
  const down = postDemoFixture(upperStation.programs.map, createAmxWorld(0, 385), 4152, 4248, 4284);
  expect(down.effect.args).toEqual([384, 21, 57, 11, 3, 0, 0, 1, 0]);
  expect(up.world.effects.map(effect => effect.name)).toEqual(['_MapChangeCore']);
  expect(down.world.effects.map(effect => effect.name)).toEqual(['_MapChangeCore']);
});

it('requires the real work16699 arrival init, then reaches summit, Jagged Pass and Lavaridge with native NPCs', async () => {
  const maps = await zoneMaps([384, 385, 83, 84, 39, 9]);
  const trip = postDemoFixture(lowerStation.programs.map, createAmxWorld(0, 384), 4124, 4220, 4256);
  let state = eventWarpState(createInitialState('zone_0384', maps), maps.zone_0385, decodeEventWarp(trip.effect.args));
  expect(state.player.pos).toEqual({ x: 23, z: 18 });
  expect(reachZone(state, 'zone_0083', maps)).toBeUndefined();
  const projected = { ...maps, zone_0385: upperArrival(trip.world, maps.zone_0385) };
  for (const target of ['zone_0083', 'zone_0084', 'zone_0039', 'zone_0009']) {
    const next = reachZone(state, target, projected);
    expect(next, `Native descent ${state.player.mapId} -> ${target} from ${JSON.stringify(state.player.pos)}`).toBeDefined();
    if (!next) return;
    state = next;
  }
  expect(projected.zone_0385.npcs?.find(n => n.id === 'zone_0385:npc:1')).toMatchObject({ pos: { x: 24, z: 18 }, visible: true });
});

it('reproduces the old Jagged z30 barrier without ledge metadata and permits only the decoded descent', async () => {
  const maps = await zoneMaps([84, 39]);
  expect(maps.zone_0084.collisions[30][38]).toBe(1);
  expect(maps.zone_0084.southLedges).toContainEqual({ x: 38, z: 30 });
  const binary = { ...maps, zone_0084: { ...maps.zone_0084, npcs: [], southLedges: undefined } };
  const state = createInitialState('zone_0084', maps);
  state.player.pos = { x: 38, z: 5 };
  expect(reachZone(state, 'zone_0039', binary)).toBeUndefined();
  expect(reachZone(state, 'zone_0039', maps)).toBeDefined();
  const before = { ...state, player: { ...state.player, pos: { x: 38, z: 29 } } };
  const after = movePlayer(before, 'down', maps);
  expect(after.player.pos).toEqual({ x: 38, z: 31 });
  expect(movePlayer(after, 'up', maps).player.pos).toEqual({ x: 38, z: 31 });
  expect(maps.zone_0084.collisions[30][38]).toBe(1);
});

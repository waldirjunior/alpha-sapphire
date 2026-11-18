import { expect, it } from 'vitest';
import { createInitialState, movePlayer } from '../../core/gameState';
import { createAmxWorld } from '../../core/amxMemory';
import { createAmxState, runAmx } from '../../core/amxRunner';
import type { AmxBundle } from '../../core/amxTypes';
import type { Direction, GameState, GridPosition, MapDefinition } from '../../core/types';
import { projectEventActors } from '../../engine/eventHost';
import route121 from '../zone_scripts/0050.json';
import { getZoneMap } from './loader';

async function corridorMaps(zones: number[]): Promise<Record<string, MapDefinition>> {
  return Object.fromEntries((await Promise.all(zones.map(getZoneMap))).map(map => [map.id, map]));
}

function checkpoint(mapId: string, pos: GridPosition, maps: Record<string, MapDefinition>): GameState {
  const state = createInitialState(mapId, maps);
  return { ...state, player: { ...state.player, pos } };
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
      if (seen.has(key(next)) || !maps[next.player.mapId]) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
}

function route121ProgressFixture() {
  const instructions = route121.programs.map.instructions.filter(row => row.offset >= 5388 && row.offset < 5520);
  const bundle: AmxBundle = { fixture: { data: [0], stackTop: 4096, program: {
    entryPoint: 5388, dispatch: null, instructions: [...instructions,
      { offset: 5520, size: 8, mnemonic: 'halt', operands: [0] }],
  } } };
  return runAmx(bundle, createAmxState(bundle, 'fixture', 0, createAmxWorld(0, 50)));
}

it('preserves native MM contacts and the Route122 leg instead of inventing Route123 to Route121', async () => {
  const maps = await corridorMaps([45, 47, 46, 48, 49, 50, 51, 52, 18]);
  expect(maps.zone_0045.name).toBe('Route 118');
  expect(maps.zone_0047.name).toBe('Route 119');
  expect(maps.zone_0052.name).toBe('Route 123');
  expect(maps.zone_0051.name).toBe('Route 122');
  expect(maps.zone_0050.name).toBe('Route 121');
  expect(maps.zone_0018.name).toBe('Lilycove City');
  expect(maps.zone_0045.boundaries).toContainEqual(expect.objectContaining({ targetMapId: 'zone_0052', inferred: false }));
  expect(maps.zone_0047.boundaries).toContainEqual(expect.objectContaining({ targetMapId: 'zone_0046', inferred: false }));
  expect(maps.zone_0048.boundaries).toContainEqual(expect.objectContaining({ targetMapId: 'zone_0049', inferred: false }));
  expect(maps.zone_0052.warps.map(w => w.targetMapId)).not.toContain('zone_0050');
  expect(maps.zone_0052.warps).toContainEqual(expect.objectContaining({ targetMapId: 'zone_0051', from: { x: 218, z: 6 } }));
  expect(maps.zone_0051.warps.map(w => w.targetMapId)).toEqual(['zone_0086', 'zone_0050', 'zone_0052']);
});

it('navigates the current core from Mauville to Route119 south without claiming Surf or terrain parity', async () => {
  const maps = await corridorMaps([15, 445, 45, 47]);
  let state = checkpoint('zone_0015', { x: 17, z: 22 }, maps);
  for (const target of ['zone_0445', 'zone_0045', 'zone_0047']) {
    const next = reachZone(state, target, maps);
    expect(next).toBeDefined();
    if (next) state = next;
  }
  expect(state.player).toMatchObject({ mapId: 'zone_0047', pos: { x: 37, z: 90 } });
});

it.each([false, true])('keeps Route119 south to north blocked, actors omitted only in diagnostic=%s', async diagnostic => {
  const loaded = await corridorMaps([47, 46]);
  const maps = diagnostic ? Object.fromEntries(Object.entries(loaded).map(([id, map]) => [id, { ...map, npcs: [] }])) : loaded;
  expect(reachZone(checkpoint('zone_0047', { x: 37, z: 90 }, maps), 'zone_0046', maps)).toBeUndefined();
  const beside = checkpoint('zone_0047', { x: 42, z: 22 }, maps);
  expect(movePlayer(beside, 'left', maps).player.pos).toEqual(beside.player.pos);
  expect(maps.zone_0047.southLedges ?? []).not.toContainEqual({ x: 41, z: 22 });
});

it('uses an independent native Route119 north arrival checkpoint to reach Fortree and Route120', async () => {
  const maps = await corridorMaps([46, 17, 48]);
  const start = checkpoint('zone_0046', { x: 75, z: 19 }, maps);
  const fortree = reachZone(start, 'zone_0017', maps);
  expect(fortree?.player.pos).toEqual({ x: 2, z: 14 });
  expect(fortree && reachZone(fortree, 'zone_0048', maps)?.player.pos).toEqual({ x: 11, z: 20 });
});

it.each([false, true])('keeps Route120 to Route121 blocked including zone49, actors omitted only in diagnostic=%s', async diagnostic => {
  const loaded = await corridorMaps([48, 49, 50]);
  const maps = diagnostic ? Object.fromEntries(Object.entries(loaded).map(([id, map]) => [id, { ...map, npcs: [] }])) : loaded;
  const start = checkpoint('zone_0048', { x: 11, z: 20 }, maps);
  expect(reachZone(start, 'zone_0050', maps)).toBeUndefined();
  const beside = checkpoint('zone_0048', { x: 42, z: 55 }, maps);
  expect(movePlayer(beside, 'down', maps).player.pos).toEqual(beside.player.pos);
});

it.each([false, true])('keeps the Route123 lateral barrier closed, actors omitted only in diagnostic=%s', async diagnostic => {
  const loaded = await corridorMaps([45, 52, 51]);
  const maps = diagnostic ? Object.fromEntries(Object.entries(loaded).map(([id, map]) => [id, { ...map, npcs: [] }])) : loaded;
  expect(reachZone(checkpoint('zone_0052', { x: 0, z: 20 }, maps), 'zone_0051', maps)).toBeUndefined();
  const beside = checkpoint('zone_0052', { x: 77, z: 28 }, maps);
  expect(movePlayer(beside, 'right', maps).player.pos).toEqual(beside.player.pos);
  expect(maps.zone_0052.southLedges).not.toContainEqual({ x: 78, z: 28 });
});

it('keeps native Route121 blocked before the explicitly bounded real progress fixture', async () => {
  const maps = await corridorMaps([50, 18]);
  expect(maps.zone_0050.npcs?.filter(n => n.spawnFlag === 670).map(n => n.id)).toEqual(
    [10, 11, 13, 14, 15, 16].map(id => `zone_0050:npc:${id}`));
  expect(reachZone(checkpoint('zone_0050', { x: 1, z: 17 }, maps), 'zone_0018', maps)).toBeUndefined();
});

it('reaches Lilycove only after the labelled real WorkSet/FlagSet/MdlDel slice without changing geometry', async () => {
  const maps = await corridorMaps([50, 18]);
  const original = structuredClone(maps.zone_0050);
  const fixture = route121ProgressFixture();
  expect(fixture.status).toBe('completed');
  expect(fixture.world.vars).toEqual({ 16530: 2 });
  expect(fixture.world.flags).toEqual({ 670: true });
  expect(fixture.world.deletedActors).toEqual(Object.fromEntries([13, 14, 15, 16, 10, 11].map(id => [`50:${id}`, true])));
  const progressed = { ...maps, zone_0050: projectEventActors(maps.zone_0050, fixture.world) };
  const start = checkpoint('zone_0050', { x: 1, z: 17 }, progressed);
  expect(reachZone(start, 'zone_0018', progressed)?.player.pos).toEqual({ x: 9, z: 21 });
  expect(maps.zone_0050).toEqual(original);
  expect(progressed.zone_0050.collisions).toEqual(original.collisions);
  expect(progressed.zone_0050.warps).toEqual(original.warps);
  expect(progressed.zone_0050.terrain).toEqual(original.terrain);
});

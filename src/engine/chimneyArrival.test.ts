import { expect, it, vi } from 'vitest';
import { createInitialState, isWalkable } from '../core/gameState';
import type { AmxWorld } from '../core/amxTypes';
import { getZoneMap } from '../data/maps_v2/loader';
import source from '../data/zone_scripts/0385.json';
import type { ZoneEventPrograms } from '../data/zone_scripts/loader';
import { ZoneEvents } from './zoneEvents';

it('restores work16699 before the real upper-station init and moves the employee without moving the player', async () => {
  let map = await getZoneMap(385);
  const state = { ...createInitialState(map.id, { [map.id]: map }),
    romEvents: { flags: { 666: true }, vars: { 16699: 1 } } };
  state.player.pos = { x: 23, z: 18 };
  const programs: ZoneEventPrograms = { zoneId: 385, zone: source,
    bundle: { 'zone:0385:entities': { program: source.programs.entities, data: [0], stackTop: 4096 } } };
  const report = vi.fn(), worlds: AmxWorld[] = [];
  const events = new ZoneEvents({ state: () => state, map: () => map,
    project: (next, world) => { map = next; worlds.push(world); },
    dialogue: vi.fn(), frames: async () => {}, warp: async () => {}, report, silentAudio: vi.fn(),
  }, async () => ({ programs, lines: [] }));
  expect(isWalkable(map, { x: 21, z: 26 })).toBe(false);
  await events.enter('warp');
  expect(map.npcs?.find(npc => npc.id === 'zone_0385:npc:1')).toMatchObject({ pos: { x: 24, z: 18 }, visible: true });
  expect(isWalkable(map, { x: 21, z: 26 })).toBe(true);
  expect(worlds.at(-1)?.actors[1]).toMatchObject({ x: 24, y: 57, z: 18 });
  expect(worlds.at(-1)?.vars[16699]).toBe(1);
  expect(state.player.pos).toEqual({ x: 23, z: 18 });
  expect(events.busy).toBe(false);
  expect(report).not.toHaveBeenCalled();
});

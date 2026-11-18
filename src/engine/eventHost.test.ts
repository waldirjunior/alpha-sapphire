import { describe, expect, it } from 'vitest';
import { createAmxWorld } from '../core/amxMemory';
import type { AmxState } from '../core/amxTypes';
import { classifyEventRequest, projectEventActors, facingNpc, mapEntryReason, projectEventPlayer } from './eventHost';
import type { MapDefinition } from '../core/types';
import { isWalkable } from '../core/gameState';

function pending(name: string, args: number[] = []): AmxState {
  return { machines: [], world: createAmxWorld(), status: 'await-input',
    awaiting: { kind: 'native', effect: { channel: 'dialogue', name, args } } };
}

describe('host de eventos AMX', () => {
  it('classifica como borda contínua mesmo quando o portal ROM também é um warp', () => {
    const map: MapDefinition = { id: 'zone_0007', name: 'Source', width: 40, height: 40, collisions: [],
      warps: [{ from: { x: 1, z: 20 }, targetMapId: 'zone_0024', targetPos: { x: 79, z: 20 }, faceDirection: 'right' }],
      boundaries: [{ from: { x: 1, z: 20 }, targetMapId: 'zone_0024', direction: 'left', length: 3,
        offset: { x: 78, z: 0 }, inferred: true }] };
    const state = { player: { id: 'p', mapId: map.id, pos: { x: 1, z: 20 }, facing: 'left' as const }, storyFlags: {} };
    expect(mapEntryReason(state, map, 'left', 'zone_0024')).toBe('boundary');
    expect(mapEntryReason(state, map, 'left', 'zone_0225')).toBe('warp');
  });

  it('converte coordenadas ROM sem usar a origem visual contínua e projeta player apenas quando autorizado', () => {
    const map: MapDefinition = { id: 'zone_0006', name: 'Town', width: 40, height: 40, collisions: [], warps: [],
      romOrigin: { x: 80, z: 160 }, worldOrigin: { x: 2, z: 80 },
      npcs: [{ id: 'zone_0006:npc:7', pos: { x: 1, z: 1 }, model: 1, modelUrl: '', script: 1, spawnFlag: 0 }] };
    const world = createAmxWorld();
    world.actors[7] = world.actors[255] = { x: 104, y: 0, z: 179, direction: 2, visible: true, moveCode: 0 };
    const state = { player: { id: 'p', mapId: map.id, pos: { x: 3, z: 4 }, facing: 'right' as const }, storyFlags: {} };
    expect(projectEventActors(map, world).npcs?.[0].pos).toEqual({ x: 24, z: 19 });
    expect(projectEventPlayer(state, map, world, false)).toBe(state);
    expect(projectEventPlayer(state, map, world, true).player).toMatchObject({ pos: { x: 24, z: 19 }, facing: 'left' });
  });
  it('resolve o primeiro argumento de TalkMdlMsg sem confundir com ponteiro ou speaker', () => {
    expect(classifyEventRequest(pending('TalkMdlMsg_Seq', [1, 0, -1, ...Array<number>(16).fill(0)]), ['zero', 'ROM real']))
      .toEqual({ kind: 'text', text: 'ROM real' });
  });
  it('não completa ACMD, câmera ou consultas desconhecidas como sucesso', () => {
    for (const name of ['MdlAcmdSet', 'EVCameraIsEndFrame', 'SEIsPlaying']) {
      expect(classifyEventRequest(pending(name), [])).toEqual({ kind: 'opaque', name });
    }
  });
  it('separa ticks de tecla e falha para texto ausente', () => {
    const state = pending('LastKeyWait');
    expect(classifyEventRequest(state, [])).toEqual({ kind: 'key' });
    state.awaiting = { kind: 'ticks', remaining: 3 };
    expect(classifyEventRequest(state, [])).toEqual({ kind: 'frames', count: 3 });
    expect(() => classifyEventRequest(pending('TalkMdlMsg_Seq', [7]), [])).toThrow('7');
  });
  it('uses nonzero spawnFlag as hide-flag while preserving flag0 and explicit actor visibility', () => {
    const map: MapDefinition = { id: 'zone_0075', zoneId: 75, name: 'Tunnel', width: 80, height: 40,
      collisions: [], warps: [], npcs: [
        { id: 'zone_0075:npc:12', model: 8204, modelUrl: '', script: 2000, spawnFlag: 676, pos: { x: 50, z: 10 } },
        { id: 'zone_0075:npc:7', model: 8204, modelUrl: '', script: 10050, spawnFlag: 0, pos: { x: 61, z: 26 } },
      ] };
    const world = createAmxWorld(0, 75);
    world.actors[12] = { x: 50, y: 0, z: 10, direction: 0, visible: true, moveCode: 0 };
    expect(projectEventActors(map, world).npcs?.[0].visible).toBe(true);
    world.flags[676] = world.flags[0] = true;
    const hidden = projectEventActors(map, world);
    expect(hidden.npcs?.map(npc => npc.visible)).toEqual([false, true]);
    world.flags[676] = false;
    expect(projectEventActors(hidden, world).npcs?.[0].visible).toBe(true);
    world.actors[12].visible = false;
    expect(projectEventActors(map, world).npcs?.[0].visible).toBe(false);
    expect(map.npcs?.[0].visible).toBeUndefined();
  });

  it('projeta posição/visibilidade sem mutar atores e encontra somente NPC à frente visível', () => {
    const map: MapDefinition = { id: 'zone_0006', zoneId: 6, name: 'Town', width: 8, height: 8,
      collisions: [], warps: [], npcs: [{ id: 'zone_0006:npc:7', model: 1, modelUrl: '', script: 14,
        spawnFlag: 0, pos: { x: 1, z: 1 } }] };
    const world = createAmxWorld();
    world.actors[7] = { x: 2, y: 3, z: 4, direction: 1, visible: true, moveCode: 0 };
    const projected = projectEventActors(map, world);
    expect(projected.npcs?.[0]).toMatchObject({ pos: { x: 2, z: 4 }, facing: 'up', visible: true });
    expect(map.npcs?.[0].pos).toEqual({ x: 1, z: 1 });
    projected.collisions = Array.from({ length: 8 }, () => Array<number>(8).fill(0));
    expect(isWalkable(projected, { x: 2, z: 4 })).toBe(false);
    expect(isWalkable({ ...projected, npcs: projected.npcs?.map(npc => ({ ...npc, visible: false })) }, { x: 2, z: 4 })).toBe(true);
    const player = { id: 'p', mapId: map.id, pos: { x: 2, z: 5 }, facing: 'up' as const };
    expect(facingNpc(player, projected)?.script).toBe(14);
    world.actors[7].visible = false;
    expect(facingNpc(player, projectEventActors(map, world))).toBeUndefined();
  });
});

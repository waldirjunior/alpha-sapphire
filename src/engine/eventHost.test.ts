import { describe, expect, it } from 'vitest';
import { createAmxWorld } from '../core/amxMemory';
import type { AmxState } from '../core/amxTypes';
import { classifyEventRequest, projectEventActors, facingNpc } from './eventHost';
import type { MapDefinition } from '../core/types';
import { isWalkable } from '../core/gameState';

function pending(name: string, args: number[] = []): AmxState {
  return { machines: [], world: createAmxWorld(), status: 'await-input',
    awaiting: { kind: 'native', effect: { channel: 'dialogue', name, args } } };
}

describe('host de eventos AMX', () => {
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

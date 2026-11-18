import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import type { AmxEffect } from '../core/amxTypes';
import type { MapDefinition } from '../core/types';
import { EventTurns, type EventActorContext } from './eventTurns';
import { eventActorRoot } from './zoneEntities';

const map: MapDefinition = { id: 'synthetic', name: 'Synthetic', width: 8, height: 8, collisions: [], warps: [] };
const context: EventActorContext = { actorId: 7, actors: {
  7: { x: 1, y: 0, z: 1, direction: 0, visible: true, moveCode: 0 },
  8: { x: 2, y: 0, z: 1, direction: 0, visible: true, moveCode: 0 },
} };
const effect = (name: string, args: number[] = []): AmxEffect => ({ channel: 'movement', name, args });

function fixture() {
  const roots: Record<number, Group> = { 7: new Group(), 8: new Group() };
  const turns = new EventTurns((_map, id) => roots[id]);
  const request = (name: string, args: number[] = []) => turns.request(effect(name, args), map, context);
  const tick = (count: number) => { for (let frame = 0; frame < count; frame += 1) turns.tick(); };
  return { roots, turns, request, tick };
}

describe('ACMD de giro', () => {
  it('resolve o root pelo identificador do ator sem confundir NPC com player', () => {
    const npcs = new Group();
    const npc = new Group();
    npc.name = 'zone_0006:npc:7';
    npcs.add(npc);
    const player = new Group();
    const sceneMap = { ...map, npcs: [{ id: npc.name, pos: { x: 1, z: 1 }, model: 1, modelUrl: '', script: 14, spawnFlag: 0 }] };
    expect(eventActorRoot(sceneMap, 7, npcs, player)).toBe(npc);
    expect(eventActorRoot(sceneMap, 255, npcs, player)).toBe(player);
    expect(eventActorRoot(sceneMap, 9, npcs, player)).toBeUndefined();
  });
  it('enfileira sem antecipar direção e conclui apenas após oito frames projetados', () => {
    const { roots, turns, request, tick } = fixture();
    expect(request('MdlAcmdInit', [7])).toBe(0);
    expect(request('MdlAcmdSet', [6, 3, 1, 1])).toBe(0);
    expect(turns.directions()).toEqual({});
    expect(request('MdlAcmdSetEnd')).toBe(0);
    expect(request('MdlAcmdUpdate', [7])).toBe(0);
    tick(4);
    expect(roots[7].rotation.y).toBeCloseTo(Math.PI / 4);
    expect(turns.directions()).toEqual({});
    tick(4);
    expect(roots[7].rotation.y).toBeCloseTo(Math.PI / 2);
    expect(request('MdlAcmdUpdate', [7])).toBe(1);
    expect(turns.directions()).toEqual({ 7: 3 });
    expect(turns.directions()).toEqual({});
    expect(context.actors[7].direction).toBe(0);
  });
  it.each([[5, 12], [6, 8], [7, 4], [250, 8], [251, 12]])('opcode %i conclui após %i frames do host', (opcode, frames) => {
    const { request, tick, turns } = fixture();
    request('MdlAcmdInit', [7]);
    expect(request('MdlAcmdSet', [opcode, 3, 1, 0])).toBe(0);
    request('MdlAcmdSetEnd');
    tick(frames - 1);
    expect(request('MdlAcmdUpdate', [7])).toBe(0);
    tick(1);
    expect(request('MdlAcmdUpdate', [7])).toBe(1);
    expect(turns.directions()).toEqual({ 7: 3 });
  });
  it('resolve Init(-1) pelo ator do evento e Update(-1) por todas as filas', () => {
    const { request, tick } = fixture();
    request('MdlAcmdInit', [65535]);
    request('MdlAcmdSet', [6, 2, 0, 0]);
    request('MdlAcmdSetEnd');
    request('MdlAcmdInit', [8]);
    request('MdlAcmdSet', [5, 1, 2, 0]);
    request('MdlAcmdSetEnd');
    tick(8);
    expect(request('MdlAcmdUpdate', [7])).toBe(1);
    expect(request('MdlAcmdUpdate', [-1])).toBe(0);
    tick(15);
    expect(request('MdlAcmdUpdate', [8])).toBe(0);
    tick(1);
    expect(request('MdlAcmdUpdate', [-1])).toBe(1);
  });
  it('não executa uma fila parcial após opcode sem implementação', () => {
    const { request, turns, tick } = fixture();
    request('MdlAcmdInit', [7]);
    request('MdlAcmdSet', [6, 3, 1, 0]);
    expect(request('MdlAcmdSet', [19, 3, 4, 1])).toBeUndefined();
    expect(request('MdlAcmdSetEnd')).toBeUndefined();
    tick(100);
    expect(request('MdlAcmdUpdate', [7])).toBeUndefined();
    expect(request('MdlAcmdUpdate', [-1])).toBeUndefined();
    expect(turns.directions()).toEqual({});
  });
  it('reset cancela filas e direção pendente da geração anterior', () => {
    const { roots, turns, request, tick } = fixture();
    request('MdlAcmdInit', [7]);
    request('MdlAcmdSet', [6, 3, 1, 0]);
    request('MdlAcmdSetEnd');
    tick(4);
    turns.reset();
    const angle = roots[7].rotation.y;
    tick(10);
    expect(roots[7].rotation.y).toBe(angle);
    expect(turns.directions()).toEqual({});
  });
});

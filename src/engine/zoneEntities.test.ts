import { describe, expect, it, vi } from 'vitest';
import { Group, Vector3 } from 'three';
import type { MapDefinition } from '../core/types';
import { advanceActorPosition, appendMapEntities, syncMapEntities } from './zoneEntities';

const map: MapDefinition = {
  id: 'elevated', name: 'Elevated', width: 2, height: 2, collisions: [[0, 0], [0, 0]], warps: [],
  worldOrigin: { x: 80, z: 160 }, groundHeights: [[1, 27], [0, 20.5]],
  npcs: [{ id: 'actor', pos: { x: 1, z: 0 }, modelUrl: 'synthetic.glb', model: 1, script: 0, spawnFlag: 0 }],
};

describe('grounded actors', () => {
  it('grounds NPCs both on construction and after event movement with unchanged X/Z projection', () => {
    const group = new Group();
    appendMapEntities(map, group, vi.fn());
    const root = group.getObjectByName('actor');
    expect(root?.position.toArray()).toEqual([81, 27, 160]);
    const expressions = { set: vi.fn() };
    syncMapEntities({ ...map, npcs: map.npcs?.map(npc => ({ ...npc, pos: { x: 1, z: 1 } })) }, group, expressions);
    expect(root?.position.toArray()).toEqual([81, 20.5, 161]);
    expect(expressions.set).toHaveBeenCalledOnce();
  });

  it('uses the existing horizontal presentation interpolation for Y, without overshoot or a second timer', () => {
    const actor = new Group();
    actor.position.set(0, 1, 0);
    advanceActorPosition(actor, new Vector3(1, 27, 1), 0.05);
    expect(actor.position.y).toBeCloseTo(1 + actor.position.x * 26);
    expect(actor.position.z).toBe(actor.position.x);
    expect(actor.position.y).toBeGreaterThan(1);
    expect(actor.position.y).toBeLessThan(27);
    const before = actor.position.clone();
    advanceActorPosition(actor, new Vector3(1, 27, 1), 0);
    expect(actor.position).toEqual(before);
  });
});

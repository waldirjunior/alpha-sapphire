import { expect, it, vi } from 'vitest';
import { Group } from 'three';
import { ContinuousTerrain } from './continuousTerrain';
import type { MapDefinition } from '../core/types';

const a: MapDefinition = { id: 'a', name: 'A', width: 40, height: 40, collisions: [], warps: [],
  worldOrigin: { x: 80, z: 160 }, modelChunks: [{ modelUrl: 'a.glb', offset: { x: 0, z: 0 } }] };

it('retains existing chunks while appending neighbors at shared world coordinates', async () => {
  const load = vi.fn(async () => ({ scene: new Group() }));
  const terrain = new ContinuousTerrain(load, () => {});
  const b = { ...a, id: 'b', worldOrigin: { x: 80, z: 120 }, modelChunks: [{ modelUrl: 'b.glb', offset: { x: 0, z: 0 } }] };
  await terrain.sync([a]);
  const first = terrain.root.children[0];
  await terrain.sync([a, b]);
  expect(terrain.root.children[0]).toBe(first);
  expect(terrain.root.children.map((group) => group.children[0].position.z)).toEqual([179.5, 139.5]);
  expect(load).toHaveBeenCalledTimes(2);
  terrain.reset();
  await terrain.sync([a]);
  expect(load).toHaveBeenCalledTimes(2);
});

it('does not append stale region responses after a reset', async () => {
  let finish: (value: { scene: Group }) => void = () => {};
  const terrain = new ContinuousTerrain(() => new Promise((resolve) => { finish = resolve; }), () => {});
  const pending = terrain.sync([a]);
  terrain.reset();
  finish({ scene: new Group() });
  await pending;
  expect(terrain.root.children).toHaveLength(0);
});

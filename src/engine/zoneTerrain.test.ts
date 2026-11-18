import { describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { loadZoneTerrain } from './zoneTerrain';

describe('zone terrain', () => {
  it('places GRs at their own 40-tile centers, including negative crop offsets', async () => {
    const load = vi.fn(async () => ({ scene: new Group() }));
    const root = await loadZoneTerrain([
      { modelUrl: 'a.glb', offset: { x: -10, z: 0 } },
      { modelUrl: 'b.glb', offset: { x: 30, z: 0 } },
    ], load, () => {});
    expect(root.children.map((child) => child.position.x)).toEqual([9.5, 49.5]);
    expect(root.children[0].scale.x).toBe(1 / 18);
    expect(root.children[0].position.z).toBe(19.5);
  });
  it('rejects incomplete terrain so the caller can retain the collision fallback', async () => {
    await expect(loadZoneTerrain([{ modelUrl: 'missing', offset: { x: 0, z: 0 } }],
      async () => { throw new Error('404'); }, () => {})).rejects.toThrow('404');
  });
});

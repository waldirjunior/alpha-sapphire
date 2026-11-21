import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { attachBattleArenaModel, battleArenaModelUrl, createBattleArena } from './battleArena';

describe('battleArena ROM assets', () => {
  it('resolves the battlefield models extracted from the ROM and keeps non-mapped interiors procedural', () => {
    expect(battleArenaModelUrl('grass')).toBe('/assets/battle-arenas/grass/grass.glb');
    expect(battleArenaModelUrl('water')).toBe('/assets/battle-arenas/water/water.glb');
    expect(battleArenaModelUrl('cave')).toBe('/assets/battle-arenas/cave/cave.glb');
    expect(battleArenaModelUrl('gym')).toBe('/assets/battle-arenas/gym/gym.glb');
    expect(battleArenaModelUrl('indoor')).toBeNull();
  });

  it('fits ROM models and keeps the procedural fallback floor and platforms available', () => {
    for (const biome of ['grass', 'water', 'cave', 'gym'] as const) {
      const arena = createBattleArena(biome);
      const model = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 10), new THREE.MeshBasicMaterial());
      mesh.position.set(3, 1, 0);
      model.add(mesh);

      attachBattleArenaModel(arena, model);

      expect(arena.romModel, `${biome} ROM model`).not.toBeNull();
      expect(arena.romModel?.parent).toBe(arena.group);
      expect(arena.romModel?.scale.x).toBeCloseTo(1.2);
      expect(arena.romModel?.position.x).toBeCloseTo(-3.6);
      expect(arena.fallbackGroup.visible).toBe(true);
      expect(arena.group.children).toContain(arena.fallbackGroup);
      expect(arena.fallbackGroup.getObjectByName('battle-procedural-backdrop')?.visible).toBe(false);
      expect(arena.fallbackGroup.getObjectByName('battle-ground')?.visible).toBe(true);
      expect(arena.fallbackGroup.getObjectByName('battle-platform-top')?.visible).toBe(true);
      expect(arena.effects.group.visible).toBe(true);
    }
  });

  it('keeps the complete procedural fallback visible when a cave ROM model fails to load', async () => {
    const { loadBattleArenaModel } = await import('./battleArenaAssets');
    const arena = createBattleArena('cave');
    const loader = {
      load: (_url: string, _onLoad: (result: { scene: THREE.Group }) => void,
        _onProgress?: (event: ProgressEvent<EventTarget>) => void, onError?: (error: unknown) => void) => {
        onError?.(new Error('test loader failure'));
      },
    };
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    loadBattleArenaModel(arena, loader, () => arena);

    expect(arena.fallbackGroup.visible).toBe(true);
    expect(arena.romModel).toBeNull();
    warning.mockRestore();
  });
});

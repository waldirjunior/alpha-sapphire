import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  attachBattleArenaModel,
  attachBattleArenaStageModel,
  battleArenaModelUrl,
  battleArenaStageModelUrl,
  createBattleArena,
} from './battleArena';

describe('battleArena ROM assets', () => {
  it('resolves ROM arena and platform/distant models for all five biomes', () => {
    expect(battleArenaModelUrl('grass')).toBe('/assets/battle-arenas/grass/grass.glb');
    expect(battleArenaModelUrl('water')).toBe('/assets/battle-arenas/water/water.glb');
    expect(battleArenaModelUrl('cave')).toBe('/assets/battle-arenas/cave/cave.glb');
    expect(battleArenaModelUrl('gym')).toBe('/assets/battle-arenas/gym/gym.glb');
    expect(battleArenaModelUrl('indoor')).toBe('/assets/battle-arenas/indoor/indoor.glb');
    expect(battleArenaStageModelUrl('grass')).toBe('/assets/battle-arenas/grass/stage/stage.glb');
    expect(battleArenaStageModelUrl('water')).toBe('/assets/battle-arenas/water/stage/stage.glb');
    expect(battleArenaStageModelUrl('cave')).toBe('/assets/battle-arenas/cave/stage/stage.glb');
    expect(battleArenaStageModelUrl('gym')).toBe('/assets/battle-arenas/gym/stage/stage.glb');
    expect(battleArenaStageModelUrl('indoor')).toBeNull();
  });

  it('keeps native ROM environment origin and fits stage layers to the battle field', () => {
    for (const biome of ['grass', 'water', 'cave', 'gym'] as const) {
      const arena = createBattleArena(biome);
      const model = createModel();
      const stage = createModel();

      attachBattleArenaModel(arena, model);
      attachBattleArenaStageModel(arena, stage);

      expect(arena.romModel, `${biome} ROM model`).not.toBeNull();
      expect(arena.romStage, `${biome} ROM stage`).not.toBeNull();
      expect(arena.romModel?.parent).toBe(arena.group);
      expect(arena.romModel?.scale.x).toBeCloseTo(0.01);
      expect(arena.romModel?.position.x).toBe(0);
      expect(arena.romModel?.position.y).toBe(0);
      expect(arena.romModel?.position.z).toBe(0);
      expect(arena.romStage?.scale.x).toBeCloseTo(1.2);
      expect(arena.romStage?.position.x).toBeCloseTo(-3.6);
      expect(arena.romStage?.position.y).toBeCloseTo(-4.8);
      expect(arena.fallbackGroup.visible).toBe(false);
      expect(arena.group.children).toContain(arena.fallbackGroup);
      expect(arena.fallbackGroup.getObjectByName('battle-ground')?.visible).toBe(false);
      expect(arena.fallbackGroup.getObjectByName('battle-platform-top')?.visible).toBe(false);
      expect(arena.effects.group.visible).toBe(true);
    }
  });

  it('uses the indoor ROM model as both backdrop and native battle platform', () => {
    const arena = createBattleArena('indoor');

    attachBattleArenaModel(arena, createModel());

    expect(arena.romModel).not.toBeNull();
    expect(arena.romStage).toBeNull();
    expect(arena.romModel?.position.y).toBeCloseTo(-4.8);
    expect(arena.fallbackGroup.visible).toBe(false);
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

  it('loads both ROM layers for mapped biomes and the indoor model for indoor battles', async () => {
    const { loadBattleArenaModel } = await import('./battleArenaAssets');
    const requested: string[] = [];
    const loader = {
      load: (url: string, onLoad: (result: { scene: THREE.Group }) => void) => {
        requested.push(url);
        onLoad({ scene: createModel() });
      },
    };
    const cave = createBattleArena('cave');
    const indoor = createBattleArena('indoor');

    loadBattleArenaModel(cave, loader, () => cave);
    loadBattleArenaModel(indoor, loader, () => indoor);

    expect(requested).toEqual([
      '/assets/battle-arenas/cave/cave.glb',
      '/assets/battle-arenas/cave/stage/stage.glb',
      '/assets/battle-arenas/indoor/indoor.glb',
    ]);
    expect(cave.romModel).not.toBeNull();
    expect(cave.romStage).not.toBeNull();
    expect(indoor.romModel).not.toBeNull();
  });
});

function createModel(): THREE.Group {
  const model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 10), new THREE.MeshBasicMaterial());
  mesh.position.set(3, 5, 0);
  model.add(mesh);
  return model;
}

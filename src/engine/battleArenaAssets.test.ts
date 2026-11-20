import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { attachBattleArenaModel, battleArenaModelUrl, createBattleArena } from './battleArena';

describe('battleArena ROM assets', () => {
  it('resolves only the battlefield models extracted from the ROM', () => {
    expect(battleArenaModelUrl('grass')).toBe('/assets/battle-arenas/grass/grass.glb');
    expect(battleArenaModelUrl('water')).toBe('/assets/battle-arenas/water/water.glb');
    expect(battleArenaModelUrl('cave')).toBeNull();
    expect(battleArenaModelUrl('indoor')).toBeNull();
  });

  it('fits a loaded ROM model to the battle surface and keeps the fallback available', () => {
    const arena = createBattleArena('grass');
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 10), new THREE.MeshBasicMaterial());
    mesh.position.x = 3;
    mesh.position.y = 1;
    model.add(mesh);

    attachBattleArenaModel(arena, model);

    expect(arena.romModel).not.toBeNull();
    expect(arena.romModel?.parent).toBe(arena.group);
    expect(arena.romModel?.scale.x).toBeCloseTo(1.2);
    expect(arena.romModel?.position.x).toBeCloseTo(-3.6);
    expect(arena.fallbackGroup.visible).toBe(true);
    expect(arena.fallbackGroup.getObjectByName('battle-procedural-backdrop')?.visible).toBe(false);
    expect(arena.fallbackGroup.getObjectByName('battle-ground')?.visible).toBe(true);
    expect(arena.fallbackGroup.getObjectByName('battle-platform-top')?.visible).toBe(true);
    expect(arena.effects.group.visible).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBattleArena, getMoveEffectStyle, MoveEffects } from './battleArena';

describe('battleArena', () => {
  it('cria estilos para os tipos suportados', () => {
    for (const type of ['fire', 'water', 'grass', 'dark', 'normal'] as const) {
      expect(getMoveEffectStyle(type).count).toBeGreaterThan(0);
    }
  });

  it('usa o efeito normal para tipos sem estilo próprio', () => {
    expect(getMoveEffectStyle('psychic')).toBe(getMoveEffectStyle('normal'));
  });

  it('emite partículas e as remove após o tempo de vida', () => {
    const effects = new MoveEffects();
    effects.play('fire', new THREE.Vector3(-1, 1, 1), new THREE.Vector3(1, 1, -1));
    expect(effects.activeCount).toBe(getMoveEffectStyle('fire').count);
    effects.update(0.1);
    expect(effects.activeCount).toBeGreaterThan(0);
    effects.update(2);
    expect(effects.activeCount).toBe(0);
    expect(effects.group.children).toHaveLength(0);
  });

  it('monta arena com luzes e grupo de efeitos', () => {
    const arena = createBattleArena();
    expect(arena.group.children).toContain(arena.effects.group);
    expect(arena.group.children.some((c) => c instanceof THREE.DirectionalLight)).toBe(true);
  });
});

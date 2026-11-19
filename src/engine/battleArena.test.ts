import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PokemonType } from '../data/pokemon/species';
import { createBattleArena, getMoveEffectStyle, MOVE_EFFECT_STYLES, MoveEffects } from './battleArena';

const ALL_TYPES: readonly PokemonType[] = [
  'normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

describe('battleArena', () => {
  it('cria estilos dedicados para todos os 18 tipos Pokémon', () => {
    for (const type of ALL_TYPES) {
      expect(MOVE_EFFECT_STYLES[type]).toBeDefined();
      expect(getMoveEffectStyle(type).count).toBeGreaterThan(0);
    }
  });

  it('usa o efeito normal para tipo desconhecido', () => {
    expect(getMoveEffectStyle('unknown' as PokemonType)).toBe(getMoveEffectStyle('normal'));
  });

  it('emite partículas e anel de impacto e os remove após o tempo de vida', () => {
    const effects = new MoveEffects();
    effects.play('fire', new THREE.Vector3(-1, 1, 1), new THREE.Vector3(1, 1, -1));
    expect(effects.activeCount).toBeGreaterThan(getMoveEffectStyle('fire').count);
    effects.update(0.1);
    expect(effects.activeCount).toBeGreaterThan(0);
    effects.update(2);
    expect(effects.activeCount).toBe(0);
    expect(effects.group.children).toHaveLength(0);
  });

  it('anima lançamento parabólico de Poké Ball e remove ao concluir', () => {
    const effects = new MoveEffects();
    effects.playPokeball(new THREE.Vector3(-1.6, 1, 1.4), new THREE.Vector3(1.6, 0.8, -1.4));
    expect(effects.activeCount).toBe(1);
    effects.update(0.25);
    expect(effects.activeCount).toBe(1);
    effects.update(2);
    expect(effects.activeCount).toBe(0);
  });

  it('monta arena com cúpula de fundo, luzes e grupo de efeitos', () => {
    const arena = createBattleArena();
    expect(arena.group.children).toContain(arena.effects.group);
    expect(arena.group.children.some((c) => c instanceof THREE.DirectionalLight)).toBe(true);
    expect(arena.group.children.some((c) => c instanceof THREE.Mesh && c.name === 'battle-sky-dome')).toBe(true);
  });
});

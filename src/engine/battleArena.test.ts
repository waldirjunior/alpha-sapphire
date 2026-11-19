import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PokemonType } from '../data/pokemon/species';
import {
  BattleCameraMotion,
  createBattleArena,
  getMoveEffectStyle,
  MOVE_EFFECT_STYLES,
  MoveEffects,
  resolveBattleArenaBiome,
  updateBattleCamera,
} from './battleArena';

const ALL_TYPES: readonly PokemonType[] = [
  'normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

describe('battleArena', () => {
  it('cria estilos dedicados para todos os 18 tipos Pokémon', () => {
    const shapes = new Set<string>();
    const colors = new Set<string>();
    for (const type of ALL_TYPES) {
      expect(MOVE_EFFECT_STYLES[type]).toBeDefined();
      expect(getMoveEffectStyle(type).count).toBeGreaterThan(0);
      expect(getMoveEffectStyle(type).shape).toBeDefined();
      shapes.add(getMoveEffectStyle(type).shape);
      colors.add(getMoveEffectStyle(type).color);
    }
    expect(shapes.size).toBe(ALL_TYPES.length);
    expect(colors.size).toBe(ALL_TYPES.length);
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
    expect(arena.biome).toBe('grass');
    expect(arena.group.children).toContain(arena.effects.group);
    expect(arena.group.children.some((c) => c instanceof THREE.DirectionalLight)).toBe(true);
    expect(arena.group.children.some((c) => c instanceof THREE.Mesh && c.name === 'battle-sky-dome')).toBe(true);
  });

  it('classifica as quatro famílias ambientais de arena a partir da zona', () => {
    expect(resolveBattleArenaBiome('Route 101', 'zone_0023')).toBe('grass');
    expect(resolveBattleArenaBiome('Route 109', 'zone_0032')).toBe('water');
    expect(resolveBattleArenaBiome('Granite Cave', 'zone_0078')).toBe('cave');
    expect(resolveBattleArenaBiome('Mossdeep Gym', 'zone_0443')).toBe('indoor');
    expect(resolveBattleArenaBiome('Mossdeep City', 'zone_0443')).toBe('indoor');
  });

  it('dá fundo, piso e luzes coerentes a cada bioma', () => {
    const grass = createBattleArena('grass');
    const water = createBattleArena('water');
    const cave = createBattleArena('cave');
    const indoor = createBattleArena('indoor');

    expect(water.group.children.some((child) => child.name === 'battle-water-ripple')).toBe(true);
    expect(cave.group.children.some((child) => child.name === 'battle-rock-spire')).toBe(true);
    expect(indoor.group.children.some((child) => child.name === 'battle-gym-line')).toBe(true);
    const grassHemisphere = grass.group.children.find((child) => child instanceof THREE.HemisphereLight);
    const waterHemisphere = water.group.children.find((child) => child instanceof THREE.HemisphereLight);
    const caveSun = cave.group.children.find((child) => child instanceof THREE.DirectionalLight);
    expect(waterHemisphere).toBeInstanceOf(THREE.HemisphereLight);
    expect(grassHemisphere).toBeInstanceOf(THREE.HemisphereLight);
    expect(waterHemisphere?.intensity).toBeGreaterThan(grassHemisphere?.intensity ?? 0);
    expect(caveSun).toBeInstanceOf(THREE.DirectionalLight);
    expect(caveSun?.intensity).toBeLessThan(1);
    expect(water.group.getObjectByName('battle-platform-base')?.type).toBe('Mesh');
    expect(indoor.group.getObjectByName('battle-platform-top')?.type).toBe('Mesh');
    expect(indoor.group.children.some((child) => child.name === 'battle-sky-dome')).toBe(true);
  });

  it('move a câmera para o ataque e retorna ao enquadramento de espera', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 250);
    const motion = new BattleCameraMotion();
    updateBattleCamera(camera, 2);
    const idlePosition = camera.position.clone();

    motion.playAttack(new THREE.Vector3(-1.6, 1, 1.4), new THREE.Vector3(1.6, 1, -1.4));
    updateBattleCamera(camera, 2, motion, 0.18);
    expect(camera.position.distanceTo(idlePosition)).toBeGreaterThan(0.1);
    const attackPosition = camera.position.clone();
    updateBattleCamera(camera, 2, motion, 0.45);
    expect(camera.position.distanceTo(attackPosition)).toBeGreaterThan(0.005);

    updateBattleCamera(camera, 2, motion, 1);
    updateBattleCamera(camera, 2);
    expect(camera.position.distanceTo(idlePosition)).toBeLessThan(0.0001);
  });
});

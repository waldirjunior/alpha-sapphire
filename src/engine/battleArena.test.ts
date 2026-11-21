import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { PokemonType } from '../data/pokemon/species';
import { BattleEventPresenter, planBattleEventPresentation } from './battleEventPresentation';
import {
  attachBattleArenaModel,
  attachBattleArenaStageModel,
  BattleCameraMotion,
  battleArenaModelUrl,
  createBattleArena,
  createBattleSlots,
  damageReactionFrame,
  getMoveEffectStyle,
  MOVE_EFFECT_STYLES,
  MoveEffects,
  normalizePokeballShakes,
  parabolicFlightPoint,
  pokeballShakeFrame,
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
    const target = new THREE.Group();
    effects.playPokeball(
      new THREE.Vector3(-1.6, 1, 1.4),
      new THREE.Vector3(1.6, 0.8, -1.4),
      target,
      false,
      2
    );
    expect(effects.activeCount).toBe(1);
    effects.update(0.25);
    expect(effects.activeCount).toBe(1);
    effects.update(2);
    expect(effects.activeCount).toBe(0);
    expect(target.visible).toBe(true);
  });

  it('esconde o alvo capturado depois de flash, três balanços e confirmação', () => {
    const effects = new MoveEffects();
    const target = new THREE.Group();
    effects.playPokeball(new THREE.Vector3(-1, 1, 1), new THREE.Vector3(1, 0.8, -1), target, true, 3);
    effects.update(2);
    expect(effects.activeCount).toBe(0);
    expect(target.visible).toBe(false);
  });

  it('calcula a trajetória parabólica sem alterar os pontos de origem e destino', () => {
    const from = { x: -1, y: 1, z: 2 };
    const to = { x: 1, y: 0.5, z: -2 };

    expect(parabolicFlightPoint(from, to, 0)).toEqual(from);
    expect(parabolicFlightPoint(from, to, 1)).toEqual(to);
    expect(parabolicFlightPoint(from, to, 0.5).y).toBeGreaterThan((from.y + to.y) / 2);
    expect(from).toEqual({ x: -1, y: 1, z: 2 });
  });

  it('limita a captura a um a três balanços e calcula recuo/flash por progresso', () => {
    expect(normalizePokeballShakes(0)).toBe(1);
    expect(normalizePokeballShakes(2.9)).toBe(2);
    expect(normalizePokeballShakes(4)).toBe(3);
    expect(Math.abs(pokeballShakeFrame(0.25).roll)).toBeGreaterThan(0);

    const hit = damageReactionFrame(0.5, 1);
    expect(hit.offsetX).toBeGreaterThan(0);
    expect(hit.flash).toBeGreaterThan(0);
    expect(damageReactionFrame(0.5, -1).offsetX).toBeLessThan(0);
    expect(damageReactionFrame(1, 1)).toEqual({ offsetX: 0, flash: 0 });
  });

  it('só inicia o efeito do golpe no evento de dano do alvo', () => {
    const steps = planBattleEventPresentation([
      { type: 'move', side: 'player', category: 'physical' },
      { type: 'damage', side: 'enemy' },
      { type: 'faint', side: 'enemy' },
      { type: 'move', side: 'enemy', category: 'special' },
      { type: 'damage', side: 'player' },
    ], { type: 'fire', attacker: 'player' }, 'water');

    expect(steps.map((step) => step.attack)).toEqual([
      null,
      { type: 'fire', attacker: 'player' },
      null,
      null,
      { type: 'water', attacker: 'enemy' },
    ]);
  });

  it('sincroniza o impacto com o clipe de dano e recua o alvo', async () => {
    const arena = createBattleArena();
    const playerSlot = new THREE.Group();
    const enemySlot = new THREE.Group();
    playerSlot.position.x = -1.6;
    enemySlot.position.x = 1.6;
    const observations: boolean[] = [];
    const presenter = new BattleEventPresenter({
      getVersion: () => 1,
      isCurrent: (version) => version === 1,
      waitForModels: async () => {},
      getArena: () => arena,
      getSlot: (side) => side === 'player' ? playerSlot : enemySlot,
      playSfx: () => {},
      playNativeEvent: async (slot, event) => {
        if (event.type === 'move') observations.push(arena.effects.activeCount === 0);
        if (event.type === 'damage') observations.push(slot.children.some((child) => child instanceof THREE.PointLight));
      },
    });
    presenter.queueAttack('fire', 'player');

    await presenter.play([
      { type: 'move', side: 'player', category: 'physical' },
      { type: 'damage', side: 'enemy' },
    ], 'normal');
    expect(observations).toEqual([true, true]);
    arena.effects.update(0.2);
    expect(enemySlot.position.x).toBeGreaterThan(1.6);
    arena.effects.update(0.3);
    expect(enemySlot.position.x).toBe(1.6);
    arena.effects.dispose();
  });

  it('monta arena com cúpula de fundo, luzes e grupo de efeitos', () => {
    const arena = createBattleArena();
    expect(arena.biome).toBe('grass');
    expect(arena.group.children).toContain(arena.effects.group);
    expect(arena.group.children.some((c) => c instanceof THREE.DirectionalLight)).toBe(true);
    expect(arena.group.getObjectByName('battle-sky-dome')).toBeInstanceOf(THREE.Mesh);
  });

  it('posiciona e orienta os slots de batalha para jogador e adversário', () => {
    const { playerSlot, enemySlot } = createBattleSlots();
    expect(playerSlot.position.toArray()).toEqual([-1.6, 0, 1.4]);
    expect(enemySlot.position.toArray()).toEqual([1.6, 0, -1.4]);
    expect(playerSlot.rotation.y).toBeCloseTo(Math.PI * 0.75);
    expect(enemySlot.rotation.y).toBeCloseTo(-Math.PI * 0.25);
  });

  it('preserva escala e origem ROM do ambiente cave/gym separado da plataforma O', () => {
    for (const [biome, rawSize, rawCenter] of [
      ['cave', [3701.65, 2881, 4062.26], [-309.175, 498.5, 0]],
      ['gym', [5472, 4254.28, 5472], [0, 639.14, 0]],
    ] as const) {
      const arena = createBattleArena(biome);
      const environment = createRawModel(rawSize, rawCenter);
      const stage = createRawModel([0.254, 0.014862, 0.254], [0, 0.006333, 0]);

      attachBattleArenaModel(arena, environment);
      attachBattleArenaStageModel(arena, stage);

      const fittedEnvironment = arena.romModel;
      const fittedStage = arena.romStage;
      if (!fittedEnvironment || !fittedStage) throw new Error(`${biome}: camada ROM ausente`);
      expect(fittedEnvironment.scale.x).toBeCloseTo(0.01);
      expect(fittedEnvironment.position.toArray()).toEqual([0, 0, 0]);
      expect(fittedStage.position.x).toBeCloseTo(0);
      expect(fittedStage.position.z).toBeCloseTo(0);
      expect(new THREE.Box3().setFromObject(fittedEnvironment).getSize(new THREE.Vector3()).x).toBeGreaterThan(12);
      expect(new THREE.Box3().setFromObject(fittedStage).getSize(new THREE.Vector3()).x).toBeCloseTo(12);
      expect(new THREE.Box3().setFromObject(fittedStage).min.y).toBeCloseTo(0);
    }
  });

  it('classifica as quatro famílias ambientais de arena a partir da zona', () => {
    expect(resolveBattleArenaBiome('Route 101', 'zone_0023')).toBe('grass');
    expect(resolveBattleArenaBiome('Route 109', 'zone_0032')).toBe('water');
    expect(resolveBattleArenaBiome('Granite Cave', 'zone_0078')).toBe('cave');
    expect(resolveBattleArenaBiome('Mossdeep Gym', 'zone_0443')).toBe('gym7');
    expect(resolveBattleArenaBiome('Mossdeep City', 'zone_0443')).toBe('gym7');
    expect(resolveBattleArenaBiome('Pokémon Center', 'zone_0228')).toBe('indoor');
  });

  it('mapeia zonas ROM comprovadas para seu ginásio e usa gym1 como fallback', () => {
    const gymZones = [
      ['zone_0441', 'gym1'],
      ['zone_0428', 'gym2'],
      ['zone_0440', 'gym3'],
      ['zone_0429', 'gym4'],
      ...Array.from({ length: 9 }, (_, index) => [`zone_${String(431 + index).padStart(4, '0')}`, 'gym5']),
      ['zone_0442', 'gym6'],
      ['zone_0443', 'gym7'],
      ['zone_0444', 'gym8'],
    ] as const;
    for (const [zoneId, gym] of gymZones) {
      expect(resolveBattleArenaBiome('City', zoneId)).toBe(gym);
    }
    expect(resolveBattleArenaBiome('Lavaridge Town', 'zone_0430')).toBe('grass');
    expect(resolveBattleArenaBiome('Unknown Gym')).toBe('gym1');
  });

  it('associa um modelo ROM aos biomas ambientais e mantém gym como alias', () => {
    for (const biome of ['grass', 'water', 'cave', 'gym', 'indoor'] as const) {
      const arena = biome === 'gym' ? 'gym1' : biome;
      expect(battleArenaModelUrl(biome)).toBe(`/assets/battle-arenas/${arena}/${arena}.glb`);
    }
  });

  it('dá fundo, piso e luzes coerentes a cada bioma', () => {
    const grass = createBattleArena('grass');
    const water = createBattleArena('water');
    const cave = createBattleArena('cave');
    const indoor = createBattleArena('indoor');

    expect(water.group.getObjectByName('battle-water-ripple')).toBeInstanceOf(THREE.Mesh);
    expect(cave.group.getObjectByName('battle-rock-spire')).toBeInstanceOf(THREE.Mesh);
    expect(indoor.group.getObjectByName('battle-gym-line')).toBeInstanceOf(THREE.Mesh);
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
    expect(indoor.group.getObjectByName('battle-sky-dome')).toBeInstanceOf(THREE.Mesh);
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

function createRawModel(size: readonly [number, number, number], center: readonly [number, number, number]): THREE.Group {
  const model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
  mesh.position.set(...center);
  model.add(mesh);
  return model;
}

import * as THREE from 'three';
import type { PokemonType } from '../data/pokemon/species';
import { MoveEffects } from './battleArenaEffects';

export { getMoveEffectStyle, MOVE_EFFECT_STYLES } from './battleMoveStyles';
export type { MoveEffectStyle, ParticleShape } from './battleMoveStyles';
export { MoveEffects } from './battleArenaEffects';
export { damageReactionFrame, normalizePokeballShakes, parabolicFlightPoint, pokeballShakeFrame } from './battleArenaMotion';

// P-014: arena estilizada e efeitos de golpe por tipo enquanto os modelos/partículas nativas completos não são extraídos.

export type BattleArenaBiome = 'grass' | 'water' | 'cave' | 'indoor' | 'gym';

export interface BattleArena {
  group: THREE.Group;
  effects: MoveEffects;
  biome: BattleArenaBiome;
  cameraMotion: BattleCameraMotion;
  fallbackGroup: THREE.Group;
  romModel: THREE.Group | null;
  romStage: THREE.Group | null;
}

interface ArenaPalette {
  sky: string;
  horizon: string;
  ground: string;
  innerGround: string;
  platformBase: string;
  platformTop: string;
  accent: string;
  directional: string;
  directionalIntensity: number;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  point: string;
  pointIntensity: number;
}

const ARENA_PALETTES: Record<BattleArenaBiome, ArenaPalette> = {
  grass: {
    sky: '#0f172a', horizon: '#38bdf8', ground: '#15803d', innerGround: '#22c55e',
    platformBase: '#94a3b8', platformTop: '#4ade80', accent: '#f8fafc', directional: '#fff7e0',
    directionalIntensity: 1.6, hemisphereSky: '#bae6fd', hemisphereGround: '#166534',
    hemisphereIntensity: 0.9, point: '#fde68a', pointIntensity: 12,
  },
  water: {
    sky: '#082f49', horizon: '#67e8f9', ground: '#075985', innerGround: '#0e7490',
    platformBase: '#155e75', platformTop: '#38bdf8', accent: '#cffafe', directional: '#e0f2fe',
    directionalIntensity: 1.3, hemisphereSky: '#bae6fd', hemisphereGround: '#164e63',
    hemisphereIntensity: 1.05, point: '#67e8f9', pointIntensity: 10,
  },
  cave: {
    sky: '#0c0a09', horizon: '#57534e', ground: '#292524', innerGround: '#44403c',
    platformBase: '#57534e', platformTop: '#a8a29e', accent: '#d6d3d1', directional: '#d6d3d1',
    directionalIntensity: 0.55, hemisphereSky: '#a8a29e', hemisphereGround: '#1c1917',
    hemisphereIntensity: 0.72, point: '#fbbf24', pointIntensity: 9,
  },
  indoor: {
    sky: '#111827', horizon: '#334155', ground: '#1e3a5f', innerGround: '#334155',
    platformBase: '#475569', platformTop: '#64748b', accent: '#f8fafc', directional: '#fef3c7',
    directionalIntensity: 0.75, hemisphereSky: '#cbd5e1', hemisphereGround: '#1e293b',
    hemisphereIntensity: 0.85, point: '#fde68a', pointIntensity: 8,
  },
  gym: {
    sky: '#111827', horizon: '#334155', ground: '#1e3a5f', innerGround: '#334155',
    platformBase: '#475569', platformTop: '#64748b', accent: '#f8fafc', directional: '#fef3c7',
    directionalIntensity: 0.75, hemisphereSky: '#cbd5e1', hemisphereGround: '#1e293b',
    hemisphereIntensity: 0.85, point: '#fde68a', pointIntensity: 8,
  },
};

const GYM_ZONE_IDS = new Set([
  'zone_0428', 'zone_0429', 'zone_0431', 'zone_0432', 'zone_0433', 'zone_0434', 'zone_0435',
  'zone_0436', 'zone_0437', 'zone_0438', 'zone_0439', 'zone_0440', 'zone_0441', 'zone_0442',
  'zone_0443', 'zone_0444',
]);
const ROM_ARENA_DIAMETER = 12;
const ROM_ENVIRONMENT_SCALE = 0.01;

export function battleArenaModelUrl(biome: BattleArenaBiome): string {
  return `/assets/battle-arenas/${biome}/${biome}.glb`;
}

export function battleArenaStageModelUrl(biome: BattleArenaBiome): string | null {
  if (biome === 'indoor') return null;
  return `/assets/battle-arenas/${biome}/stage/stage.glb`;
}

export function attachBattleArenaModel(arena: BattleArena, model: THREE.Group): void {
  const fittedModel = arena.biome === 'indoor'
    ? fitBattleArenaStage(model, arena.biome, 'battle-rom-arena-model')
    : fitBattleArenaEnvironment(model, arena.biome);
  if (!fittedModel) return;
  arena.group.add(fittedModel);
  arena.romModel = fittedModel;
  if (arena.biome === 'indoor') hideProceduralFallback(arena);
}

export function attachBattleArenaStageModel(arena: BattleArena, model: THREE.Group): void {
  const fittedModel = fitBattleArenaStage(model, arena.biome, 'battle-rom-arena-stage');
  if (!fittedModel) return;
  arena.group.add(fittedModel);
  arena.romStage = fittedModel;
  hideProceduralFallback(arena);
}

function fitBattleArenaEnvironment(model: THREE.Group, biome: BattleArenaBiome): THREE.Group | null {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || Math.max(size.x, size.z) <= 0) return null;
  const fittedModel = new THREE.Group();
  fittedModel.name = 'battle-rom-arena-model';
  fittedModel.userData.biome = biome;
  fittedModel.add(model);
  fittedModel.scale.setScalar(ROM_ENVIRONMENT_SCALE);
  return fittedModel;
}

function fitBattleArenaStage(
  model: THREE.Group,
  biome: BattleArenaBiome,
  name: string,
): THREE.Group | null {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const horizontalSize = Math.max(size.x, size.z);
  if (horizontalSize <= 0) return null;

  const scale = ROM_ARENA_DIAMETER / horizontalSize;
  const center = bounds.getCenter(new THREE.Vector3());
  const fittedModel = new THREE.Group();
  fittedModel.name = name;
  fittedModel.userData.biome = biome;
  fittedModel.add(model);
  fittedModel.scale.setScalar(scale);
  const groundOffset = -bounds.min.y * scale;
  fittedModel.position.set(-center.x * scale, groundOffset, -center.z * scale);
  return fittedModel;
}

function hideProceduralFallback(arena: BattleArena): void {
  arena.fallbackGroup.traverse((object) => { object.visible = false; });
  arena.fallbackGroup.visible = false;
}

export function resolveBattleArenaBiome(zoneName: string, zoneId = ''): BattleArenaBiome {
  const name = zoneName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (GYM_ZONE_IDS.has(zoneId) || /\bgym\b/.test(name)) return 'gym';
  if (/pokemon league|pokemon center|pokemart|house|lab|contest hall|secret base|department store|museum|s\.s\. tidal/.test(name)) {
    return 'indoor';
  }
  if (/cave|cavern|falls|tunnel|chamber|ruins|mountain|mt\.|pyre|fiery path|den/.test(name)) {
    return 'cave';
  }
  const route = name.match(/route\s+(\d+)/);
  const routeNumber = route ? Number(route[1]) : 0;
  if ((routeNumber >= 105 && routeNumber <= 109) || (routeNumber >= 124 && routeNumber <= 134)) {
    return 'water';
  }
  if (/beach|shore|islet|pacifidlog|sea mauville|sootopolis|battle resort/.test(name)) return 'water';
  return 'grass';
}

interface CameraAttack {
  from: THREE.Vector3;
  to: THREE.Vector3;
  age: number;
}

export class BattleCameraMotion {
  private attack: CameraAttack | null = null;
  private readonly duration = 0.85;

  public playAttack(from: THREE.Vector3, to: THREE.Vector3): void {
    this.attack = { from: from.clone(), to: to.clone(), age: 0 };
  }

  public cancel(): void {
    this.attack = null;
  }

  public update(camera: THREE.PerspectiveCamera, elapsedSec: number, dt: number): boolean {
    if (!this.attack) return false;
    this.attack.age += Math.max(0, dt);
    if (this.attack.age >= this.duration) {
      this.attack = null;
      return false;
    }
    this.applyAttackPose(camera, elapsedSec, this.attack);
    return true;
  }

  private applyAttackPose(camera: THREE.PerspectiveCamera, elapsedSec: number, attack: CameraAttack): void {
    const t = attack.age / this.duration;
    const blend = Math.sin(Math.PI * t);
    const midpoint = attack.from.clone().add(attack.to).multiplyScalar(0.5);
    const aim = new THREE.Vector3(0.4, 0.8, -0.4).lerp(midpoint, blend * 0.72);
    const impact = Math.exp(-Math.abs(t - 0.57) * 26) * Math.sin(attack.age * 58) * 0.07;
    const direction = attack.to.clone().sub(attack.from).normalize();
    camera.position.set(
      -3.6 + Math.sin(elapsedSec * 0.55) * 0.25 + direction.x * blend * 0.2 + impact,
      2.5 + Math.sin(elapsedSec * 0.8) * 0.08 + blend * 0.3 + impact * 0.65,
      4.4 + Math.cos(elapsedSec * 0.45) * 0.18 + direction.z * blend * 0.2
    );
    camera.lookAt(aim);
  }
}

export function updateBattleCamera(
  camera: THREE.PerspectiveCamera,
  elapsedSec: number,
  motion?: BattleCameraMotion,
  dt = 0
): void {
  if (motion?.update(camera, elapsedSec, dt)) return;
  camera.position.set(
    -3.6 + Math.sin(elapsedSec * 0.55) * 0.25,
    2.5 + Math.sin(elapsedSec * 0.8) * 0.08,
    4.4 + Math.cos(elapsedSec * 0.45) * 0.18
  );
  camera.lookAt(0.4, 0.8, -0.4);
}

function addSkyDome(group: THREE.Group, palette: ArenaPalette): void {
  const geo = new THREE.SphereGeometry(28, 24, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(palette.sky);
  const horizon = new THREE.Color(palette.horizon);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) + 2) / 22));
    tmp.copy(horizon).lerp(top, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  dome.name = 'battle-sky-dome';
  group.add(dome);
}

function addPlatform(group: THREE.Group, x: number, z: number, biome: BattleArenaBiome, palette: ArenaPalette): void {
  const baseGeometry = biome === 'indoor' || biome === 'gym'
    ? new THREE.BoxGeometry(2.5, 0.2, 2.5)
    : biome === 'cave'
      ? new THREE.DodecahedronGeometry(1.25, 1)
      : new THREE.CylinderGeometry(1.3, 1.45, 0.2, 32);
  const topGeometry = biome === 'indoor' || biome === 'gym'
    ? new THREE.BoxGeometry(2.25, 0.06, 2.25)
    : new THREE.CylinderGeometry(1.15, 1.15, 0.06, 32);
  const base = new THREE.Mesh(baseGeometry, new THREE.MeshStandardMaterial({ color: palette.platformBase, roughness: 0.8 }));
  base.name = 'battle-platform-base';
  base.position.set(x, biome === 'cave' ? 0.2 : 0.1, z);
  if (biome === 'cave') base.scale.y = 0.3;
  const top = new THREE.Mesh(topGeometry, new THREE.MeshStandardMaterial({ color: palette.platformTop, roughness: 0.9 }));
  top.name = 'battle-platform-top';
  top.position.set(x, 0.22, z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.04, 8, 40),
    new THREE.MeshStandardMaterial({
      color: palette.accent,
      emissive: biome === 'grass' ? '#e2e8f0' : palette.accent,
      emissiveIntensity: biome === 'grass' ? 0.35 : 0.2,
    }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.26, z);
  ring.name = 'battle-platform-ring';
  group.add(base, top, ring);
}

function addGround(group: THREE.Group, palette: ArenaPalette): void {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(10, 48),
    new THREE.MeshStandardMaterial({ color: palette.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.name = 'battle-ground';
  const inner = new THREE.Mesh(new THREE.RingGeometry(3.5, 5.5, 48),
    new THREE.MeshStandardMaterial({ color: palette.innerGround, roughness: 1 }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.01;
  inner.name = 'battle-ground-ring';
  group.add(ground, inner);
}

function addGrassTufts(group: THREE.Group): void {
  const geometry = new THREE.ConeGeometry(0.12, 0.45, 5);
  const material = new THREE.MeshStandardMaterial({ color: '#16a34a' });
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const radius = 5.8 + (i % 3) * 0.7;
    const tuft = new THREE.Mesh(geometry, material);
    tuft.position.set(Math.cos(angle) * radius, 0.22, Math.sin(angle) * radius);
    group.add(tuft);
  }
}

function addWaterDecor(group: THREE.Group): void {
  const ripple = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.035, 6, 64),
    new THREE.MeshBasicMaterial({ color: '#a5f3fc', transparent: true, opacity: 0.72 }));
  ripple.rotation.x = Math.PI / 2;
  ripple.position.y = 0.03;
  ripple.name = 'battle-water-ripple';
  group.add(ripple);
}

function addCaveDecor(group: THREE.Group): void {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.6 + (i % 2) * 0.25, 1.8, 5),
      new THREE.MeshStandardMaterial({ color: i % 2 ? '#57534e' : '#78716c', roughness: 1 }));
    spire.position.set(Math.cos(angle) * 7.2, 0.8, Math.sin(angle) * 7.2);
    spire.rotation.z = (i % 2 ? -1 : 1) * 0.12;
    spire.name = 'battle-rock-spire';
    group.add(spire);
  }
}

function addGymLines(group: THREE.Group): void {
  const material = new THREE.MeshBasicMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.68 });
  for (const [width, depth] of [[8, 0.07], [0.07, 6]] as const) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, depth), material);
    line.position.set(0, 0.03, 0);
    line.name = 'battle-gym-line';
    group.add(line);
  }
}

function addLights(group: THREE.Group, palette: ArenaPalette): void {
  const sun = new THREE.DirectionalLight(palette.directional, palette.directionalIntensity);
  sun.position.set(4, 8, 5);
  const ambient = new THREE.HemisphereLight(
    palette.hemisphereSky, palette.hemisphereGround, palette.hemisphereIntensity
  );
  const rim = new THREE.PointLight(palette.point, palette.pointIntensity, 12);
  rim.position.set(1.6, 2.5, -1.4);
  group.add(sun, ambient, rim);
}

export function createBattleArena(biome: BattleArenaBiome = 'grass'): BattleArena {
  const group = new THREE.Group();
  const fallbackGroup = new THREE.Group();
  const backdropGroup = new THREE.Group();
  const palette = ARENA_PALETTES[biome];
  group.userData.biome = biome;
  fallbackGroup.name = 'battle-procedural-fallback';
  backdropGroup.name = 'battle-procedural-backdrop';
  addSkyDome(backdropGroup, palette);
  if (biome === 'grass') addGrassTufts(backdropGroup);
  if (biome === 'water') addWaterDecor(backdropGroup);
  if (biome === 'cave') addCaveDecor(backdropGroup);
  if (biome === 'indoor' || biome === 'gym') addGymLines(backdropGroup);
  fallbackGroup.add(backdropGroup);
  addGround(fallbackGroup, palette);
  addPlatform(fallbackGroup, -1.6, 1.4, biome, palette);
  addPlatform(fallbackGroup, 1.6, -1.4, biome, palette);
  group.add(fallbackGroup);
  addLights(group, palette);
  const effects = new MoveEffects();
  group.add(effects.group);
  return { group, effects, biome, cameraMotion: new BattleCameraMotion(), fallbackGroup, romModel: null, romStage: null };
}

export function createBattleSlots(): { playerSlot: THREE.Group; enemySlot: THREE.Group } {
  const playerSlot = new THREE.Group();
  playerSlot.position.set(-1.6, 0, 1.4);
  playerSlot.rotation.y = Math.PI * 0.75;
  const enemySlot = new THREE.Group();
  enemySlot.position.set(1.6, 0, -1.4);
  enemySlot.rotation.y = -Math.PI * 0.25;
  return { playerSlot, enemySlot };
}

export function replaceBattleArena(
  parent: THREE.Group,
  current: BattleArena,
  zoneName: string,
  zoneId: string
): BattleArena {
  const biome = resolveBattleArenaBiome(zoneName, zoneId);
  if (current.biome === biome) return current;
  parent.remove(current.group);
  disposeBattleArena(current);
  const replacement = createBattleArena(biome);
  parent.add(replacement.group);
  return replacement;
}

export function playBattleAttack(
  arena: BattleArena,
  type: PokemonType,
  attacker: 'player' | 'enemy',
  playerSlot: THREE.Group,
  enemySlot: THREE.Group
): void {
  const fromSlot = attacker === 'player' ? playerSlot : enemySlot;
  const toSlot = attacker === 'player' ? enemySlot : playerSlot;
  const from = fromSlot.position.clone().setY(1);
  const to = toSlot.position.clone().setY(1);
  arena.effects.play(type, from, to);
  arena.cameraMotion.playAttack(from, to);
}

export function playBattleDamage(arena: BattleArena, target: THREE.Group, attacker: THREE.Group): void {
  arena.effects.playDamage(target, attacker);
}

export function playBattlePokeball(
  arena: BattleArena,
  playerSlot: THREE.Group,
  enemySlot: THREE.Group,
  captured = false,
  shakes = captured ? 3 : 1
): void {
  arena.effects.playPokeball(
    playerSlot.position.clone().setY(1.1),
    enemySlot.position.clone().setY(0.8),
    enemySlot,
    captured,
    shakes
  );
}

export function disposeBattleArena(arena: BattleArena): void {
  arena.effects.dispose();
  const geometries = new Set<THREE.BufferGeometry>();
  const sharedMaterials = new Set<THREE.Material>();
  arena.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of objectMaterials) sharedMaterials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of sharedMaterials) material.dispose();
}

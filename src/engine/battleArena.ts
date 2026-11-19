import * as THREE from 'three';
import type { PokemonType } from '../data/pokemon/species';

// P-014: arena estilizada e efeitos de golpe por tipo enquanto os modelos/partículas nativas completos não são extraídos.

export interface MoveEffectStyle {
  color: string;
  count: number;
  speed: number;
  size: number;
  /** Aceleração vertical (positiva sobe, negativa cai). */
  lift: number;
  lifetime: number;
}

export const MOVE_EFFECT_STYLES: Partial<Record<PokemonType, MoveEffectStyle>> = {
  normal: { color: '#f8fafc', count: 24, speed: 3.0, size: 0.15, lift: 0.0, lifetime: 0.6 },
  fire: { color: '#fb923c', count: 40, speed: 3.2, size: 0.16, lift: 1.8, lifetime: 0.8 },
  water: { color: '#38bdf8', count: 40, speed: 3.6, size: 0.13, lift: -3.5, lifetime: 0.8 },
  grass: { color: '#4ade80', count: 32, speed: 2.8, size: 0.18, lift: 0.4, lifetime: 0.9 },
  electric: { color: '#facc15', count: 38, speed: 4.4, size: 0.13, lift: 0.2, lifetime: 0.65 },
  ice: { color: '#a5f3fc', count: 34, speed: 3.1, size: 0.14, lift: -0.6, lifetime: 0.85 },
  fighting: { color: '#f97316', count: 28, speed: 4.0, size: 0.17, lift: 0.1, lifetime: 0.55 },
  poison: { color: '#c084fc', count: 34, speed: 2.6, size: 0.16, lift: 0.9, lifetime: 0.85 },
  ground: { color: '#d97706', count: 32, speed: 2.9, size: 0.18, lift: -2.8, lifetime: 0.75 },
  flying: { color: '#bae6fd', count: 30, speed: 4.2, size: 0.14, lift: 1.4, lifetime: 0.7 },
  psychic: { color: '#f472b6', count: 36, speed: 2.7, size: 0.17, lift: 0.5, lifetime: 0.85 },
  bug: { color: '#a3e635', count: 30, speed: 3.3, size: 0.13, lift: 0.6, lifetime: 0.75 },
  rock: { color: '#a8a29e', count: 26, speed: 3.0, size: 0.2, lift: -3.2, lifetime: 0.7 },
  ghost: { color: '#818cf8', count: 34, speed: 2.2, size: 0.18, lift: 1.2, lifetime: 0.95 },
  dragon: { color: '#6366f1', count: 42, speed: 3.8, size: 0.18, lift: 0.8, lifetime: 0.85 },
  dark: { color: '#6d28d9', count: 36, speed: 2.4, size: 0.2, lift: 0.0, lifetime: 0.9 },
  steel: { color: '#cbd5e1', count: 28, speed: 3.9, size: 0.14, lift: -0.4, lifetime: 0.65 },
  fairy: { color: '#fbcfe8', count: 36, speed: 2.8, size: 0.15, lift: 1.1, lifetime: 0.9 },
};

export function getMoveEffectStyle(type: PokemonType): MoveEffectStyle {
  const style = MOVE_EFFECT_STYLES[type] ?? MOVE_EFFECT_STYLES.normal;
  if (!style) throw new Error(`Efeito "normal" ausente para o tipo "${type}".`);
  return style;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  lifetime: number;
  lift: number;
}

interface ImpactRing {
  mesh: THREE.Mesh;
  age: number;
  lifetime: number;
}

interface PokeballArc {
  group: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  age: number;
  duration: number;
}

function disposeObjectMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) mat.dispose();
  });
}

export class MoveEffects {
  public readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private rings: ImpactRing[] = [];
  private pokeballs: PokeballArc[] = [];
  private readonly geometry = new THREE.SphereGeometry(1, 6, 6);
  private readonly ringGeometry = new THREE.TorusGeometry(0.45, 0.05, 8, 28);

  public get activeCount(): number {
    return this.particles.length + this.rings.length + this.pokeballs.length;
  }

  public play(type: PokemonType, from: THREE.Vector3, to: THREE.Vector3): void {
    const style = getMoveEffectStyle(type);
    const direction = to.clone().sub(from).normalize();
    for (let i = 0; i < style.count; i++) {
      this.particles.push(this.spawn(style, from, direction));
    }
    this.rings.push(this.spawnRing(style.color, to));
  }

  public playPokeball(from: THREE.Vector3, to: THREE.Vector3): void {
    const ball = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.35 })
    );
    const bottom = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35 })
    );
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.022, 6, 16),
      new THREE.MeshStandardMaterial({ color: '#0f172a' })
    );
    band.rotation.x = Math.PI / 2;
    ball.add(top, bottom, band);
    ball.position.copy(from);
    this.group.add(ball);
    this.pokeballs.push({ group: ball, from: from.clone(), to: to.clone(), age: 0, duration: 0.65 });
  }

  private spawnRing(color: string, at: THREE.Vector3): ImpactRing {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(this.ringGeometry, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copy(at);
    this.group.add(mesh);
    return { mesh, age: 0, lifetime: 0.45 };
  }

  private spawn(style: MoveEffectStyle, from: THREE.Vector3, direction: THREE.Vector3): Particle {
    const material = new THREE.MeshBasicMaterial({ color: style.color, transparent: true });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.scale.setScalar(style.size * (0.6 + Math.random() * 0.8));
    mesh.position.copy(from);
    const spread = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(0.9);
    const velocity = direction.clone().add(spread).multiplyScalar(style.speed * (0.7 + Math.random() * 0.6));
    this.group.add(mesh);
    return { mesh, velocity, age: 0, lifetime: style.lifetime, lift: style.lift };
  }

  public update(dt: number): void {
    this.particles = this.particles.filter((p) => {
      p.age += dt;
      if (p.age >= p.lifetime) {
        this.group.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        return false;
      }
      p.velocity.y += p.lift * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - p.age / p.lifetime;
      return true;
    });

    this.pokeballs = this.pokeballs.filter((b) => {
      b.age += dt;
      const t = Math.min(1, b.age / b.duration);
      b.group.position.lerpVectors(b.from, b.to, t);
      b.group.position.y += Math.sin(t * Math.PI) * 1.4;
      b.group.rotation.z += dt * 10;
      if (b.age >= b.duration) {
        this.rings.push(this.spawnRing('#fef08a', b.to));
        this.group.remove(b.group);
        disposeObjectMaterials(b.group);
        return false;
      }
      return true;
    });

    this.rings = this.rings.filter((r) => {
      r.age += dt;
      if (r.age >= r.lifetime) {
        this.group.remove(r.mesh);
        (r.mesh.material as THREE.Material).dispose();
        return false;
      }
      const t = r.age / r.lifetime;
      r.mesh.scale.setScalar(1 + t * 2.4);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      return true;
    });
  }
}

export interface BattleArena {
  group: THREE.Group;
  effects: MoveEffects;
}

export function updateBattleCamera(camera: THREE.PerspectiveCamera, elapsedSec: number): void {
  camera.position.set(
    -3.6 + Math.sin(elapsedSec * 0.55) * 0.25,
    2.5 + Math.sin(elapsedSec * 0.8) * 0.08,
    4.4 + Math.cos(elapsedSec * 0.45) * 0.18
  );
  camera.lookAt(0.4, 0.8, -0.4);
}

function addSkyDome(group: THREE.Group): void {
  const geo = new THREE.SphereGeometry(28, 24, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color('#0f172a');
  const horizon = new THREE.Color('#38bdf8');
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

function addPlatform(group: THREE.Group, x: number, z: number, color: string): void {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.45, 0.2, 32),
    new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.8 })
  );
  base.position.set(x, 0.1, z);
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 0.06, 32),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  top.position.set(x, 0.22, z);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.04, 8, 40),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#e2e8f0', emissiveIntensity: 0.35 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.26, z);
  group.add(base, top, ring);
}

function addGround(group: THREE.Group): void {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(10, 48),
    new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(3.5, 5.5, 48),
    new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 1 })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.01;
  group.add(ground, inner);
}

function addTufts(group: THREE.Group): void {
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

function addLights(group: THREE.Group): void {
  const sun = new THREE.DirectionalLight('#fff7e0', 1.6);
  sun.position.set(4, 8, 5);
  const ambient = new THREE.HemisphereLight('#bae6fd', '#166534', 0.9);
  const rim = new THREE.PointLight('#fde68a', 12, 12);
  rim.position.set(1.6, 2.5, -1.4);
  group.add(sun, ambient, rim);
}

export function createBattleArena(): BattleArena {
  const group = new THREE.Group();
  addSkyDome(group);
  addGround(group);
  addTufts(group);
  addPlatform(group, -1.6, 1.4, '#4ade80');
  addPlatform(group, 1.6, -1.4, '#86efac');
  addLights(group);
  const effects = new MoveEffects();
  group.add(effects.group);
  return { group, effects };
}

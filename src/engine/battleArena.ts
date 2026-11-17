import * as THREE from 'three';
import type { PokemonType } from '../data/pokemon/species';

// P-014: arena procedural estilizada enquanto os modelos reais da ROM não são extraídos.

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
  fire: { color: '#fb923c', count: 40, speed: 3.2, size: 0.16, lift: 1.8, lifetime: 0.8 },
  water: { color: '#38bdf8', count: 40, speed: 3.6, size: 0.13, lift: -3.5, lifetime: 0.8 },
  grass: { color: '#4ade80', count: 32, speed: 2.8, size: 0.18, lift: 0.4, lifetime: 0.9 },
  dark: { color: '#6d28d9', count: 36, speed: 2.4, size: 0.2, lift: 0, lifetime: 0.9 },
  normal: { color: '#f8fafc', count: 24, speed: 3, size: 0.15, lift: 0, lifetime: 0.6 },
};

// Tipos sem estilo próprio (bug, psychic, fairy...) usam o efeito normal até P-014 cobrir todos.
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

export class MoveEffects {
  public readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private readonly geometry = new THREE.SphereGeometry(1, 6, 6);

  public get activeCount(): number {
    return this.particles.length;
  }

  public play(type: PokemonType, from: THREE.Vector3, to: THREE.Vector3): void {
    const style = getMoveEffectStyle(type);
    const direction = to.clone().sub(from).normalize();
    for (let i = 0; i < style.count; i++) {
      this.particles.push(this.spawn(style, from, direction));
    }
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
  }
}

export interface BattleArena {
  group: THREE.Group;
  effects: MoveEffects;
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
    new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#e2e8f0', emissiveIntensity: 0.3 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.26, z);
  group.add(base, top, ring);
}

function addGround(group: THREE.Group): void {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(8, 48),
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
  addGround(group);
  addTufts(group);
  addPlatform(group, -1.6, 1.4, '#4ade80');
  addPlatform(group, 1.6, -1.4, '#86efac');
  addLights(group);
  const effects = new MoveEffects();
  group.add(effects.group);
  return { group, effects };
}

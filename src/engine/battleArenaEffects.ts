import * as THREE from 'three';
import type { PokemonType } from '../data/pokemon/species';
import { createParticleGeometry, getMoveEffectStyle, type MoveEffectStyle, type ParticleShape } from './battleMoveStyles';
import {
  damageReactionFrame,
  normalizePokeballShakes,
  parabolicFlightPoint,
  pokeballShakeFrame,
} from './battleArenaMotion';

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

type PokeballPhase = 'flight' | 'opening' | 'shaking' | 'result' | 'result-done';

interface PokeballArc {
  group: THREE.Group;
  from: THREE.Vector3;
  to: THREE.Vector3;
  age: number;
  phase: PokeballPhase;
  phaseAge: number;
  captured: boolean;
  shakes: number;
  shakeIndex: number;
  target: THREE.Group;
  targetWasVisible: boolean;
  top: THREE.Mesh;
  bottom: THREE.Mesh;
  flash: THREE.Mesh;
}

interface DamageReaction {
  slot: THREE.Group;
  light: THREE.PointLight;
  basePosition: THREE.Vector3;
  direction: number;
  age: number;
  duration: number;
}

const POKEBALL_FLIGHT_DURATION = 0.65;
const POKEBALL_OPEN_DURATION = 0.18;
const POKEBALL_SHAKE_DURATION = 0.22;
const POKEBALL_RESULT_DURATION = 0.36;
const DAMAGE_REACTION_DURATION = 0.38;

function disposeObjectResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export class MoveEffects {
  public readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private rings: ImpactRing[] = [];
  private pokeballs: PokeballArc[] = [];
  private damageReactions: DamageReaction[] = [];
  private readonly geometries = new Map<ParticleShape, THREE.BufferGeometry>();
  private readonly ringGeometry = new THREE.TorusGeometry(0.45, 0.05, 8, 28);

  public get activeCount(): number {
    return this.particles.length + this.rings.length + this.pokeballs.length + this.damageReactions.length;
  }

  public play(type: PokemonType, from: THREE.Vector3, to: THREE.Vector3): void {
    const style = getMoveEffectStyle(type);
    const direction = to.clone().sub(from).normalize();
    for (let i = 0; i < style.count; i++) this.particles.push(this.spawn(style, from, direction));
    this.rings.push(this.spawnRing(style.color, to));
  }

  public playDamage(target: THREE.Group, attacker: THREE.Group): void {
    this.stopDamageReaction(target);
    const light = new THREE.PointLight('#ffffff', 0, 3.2, 2);
    light.position.set(0, 1, 0);
    target.add(light);
    this.damageReactions.push({
      slot: target,
      light,
      basePosition: target.position.clone(),
      direction: Math.sign(target.position.x - attacker.position.x) || 1,
      age: 0,
      duration: DAMAGE_REACTION_DURATION,
    });
    this.rings.push(this.spawnRing('#ffffff', target.position.clone().setY(1)));
  }

  public playPokeball(
    from: THREE.Vector3,
    to: THREE.Vector3,
    target: THREE.Group,
    captured: boolean,
    shakes: number
  ): void {
    const group = new THREE.Group();
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
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })
    );
    band.rotation.x = Math.PI / 2;
    flash.visible = false;
    group.add(top, bottom, band, flash);
    group.position.copy(from);
    this.group.add(group);
    this.pokeballs.push({
      group,
      from: from.clone(),
      to: to.clone(),
      age: 0,
      phase: 'flight',
      phaseAge: 0,
      captured,
      shakes: normalizePokeballShakes(shakes),
      shakeIndex: 0,
      target,
      targetWasVisible: target.visible,
      top,
      bottom,
      flash,
    });
  }

  public dispose(): void {
    this.damageReactions.forEach((reaction) => this.finishDamageReaction(reaction));
    for (const ball of this.pokeballs) {
      ball.target.visible = ball.targetWasVisible;
      this.group.remove(ball.group);
      disposeObjectResources(ball.group);
    }
    for (const particle of this.particles) (particle.mesh.material as THREE.Material).dispose();
    for (const ring of this.rings) (ring.mesh.material as THREE.Material).dispose();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.ringGeometry.dispose();
    this.geometries.clear();
    this.particles = [];
    this.rings = [];
    this.pokeballs = [];
    this.damageReactions = [];
    this.group.clear();
  }

  public update(dt: number): void {
    const step = Math.max(0, dt);
    this.pokeballs = this.pokeballs.filter((ball) => this.advancePokeball(ball, step));
    this.updateParticles(step);
    this.updateDamageReactions(step);
    this.updateRings(step);
  }

  private updateParticles(dt: number): void {
    this.particles = this.particles.filter((particle) => {
      particle.age += dt;
      if (particle.age >= particle.lifetime) {
        this.group.remove(particle.mesh);
        (particle.mesh.material as THREE.Material).dispose();
        return false;
      }
      particle.velocity.y += particle.lift * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - particle.age / particle.lifetime;
      return true;
    });
  }

  private updateDamageReactions(dt: number): void {
    this.damageReactions = this.damageReactions.filter((reaction) => {
      reaction.age += dt;
      const progress = Math.min(1, reaction.age / reaction.duration);
      const frame = damageReactionFrame(progress, reaction.direction);
      reaction.slot.position.copy(reaction.basePosition);
      reaction.slot.position.x += frame.offsetX;
      reaction.light.intensity = 5 * frame.flash;
      if (progress < 1) return true;
      this.finishDamageReaction(reaction);
      return false;
    });
  }

  private advancePokeball(ball: PokeballArc, dt: number): boolean {
    let remaining = dt;
    while (remaining > 0 && ball.phase !== 'result-done') {
      const duration = this.pokeballPhaseDuration(ball);
      const timeLeft = duration - ball.phaseAge;
      const step = Math.min(remaining, timeLeft);
      ball.phaseAge += step;
      ball.age += step;
      remaining -= step;
      this.applyPokeballPose(ball, duration);
      if (ball.phaseAge >= duration) this.advancePokeballPhase(ball);
    }
    if (ball.phase !== 'result-done') return true;
    this.group.remove(ball.group);
    disposeObjectResources(ball.group);
    return false;
  }

  private pokeballPhaseDuration(ball: PokeballArc): number {
    if (ball.phase === 'flight') return POKEBALL_FLIGHT_DURATION;
    if (ball.phase === 'opening') return POKEBALL_OPEN_DURATION;
    if (ball.phase === 'shaking') return POKEBALL_SHAKE_DURATION;
    return POKEBALL_RESULT_DURATION;
  }

  private applyPokeballPose(ball: PokeballArc, duration: number): void {
    const progress = Math.min(1, ball.phaseAge / duration);
    if (ball.phase === 'flight') {
      const point = parabolicFlightPoint(ball.from, ball.to, progress);
      ball.group.position.set(point.x, point.y, point.z);
      ball.group.rotation.z = progress * Math.PI * 4;
      return;
    }
    if (ball.phase === 'opening') {
      this.applyOpeningFlash(ball, progress);
      return;
    }
    if (ball.phase === 'shaking') {
      const frame = pokeballShakeFrame(progress);
      ball.group.position.set(ball.to.x + frame.offsetX, ball.to.y, ball.to.z);
      ball.group.rotation.z = frame.roll;
      ball.top.position.y = 0.08;
      ball.bottom.position.y = -0.08;
      return;
    }
    this.applyResultPose(ball, progress);
  }

  private applyOpeningFlash(ball: PokeballArc, progress: number): void {
    const flash = ball.flash;
    flash.visible = true;
    flash.scale.setScalar(0.3 + progress * 2.4);
    (flash.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * progress) * 0.95;
    ball.top.position.y = progress * 0.22;
    ball.bottom.position.y = -progress * 0.22;
  }

  private applyResultPose(ball: PokeballArc, progress: number): void {
    const opening = ball.captured ? 0.1 * (1 - progress) : 0.3 * (1 - progress);
    ball.top.position.y = opening;
    ball.bottom.position.y = -opening;
    ball.group.rotation.z = 0;
    flashOpacity(ball.flash, 1 - progress);
  }

  private advancePokeballPhase(ball: PokeballArc): void {
    ball.phaseAge = 0;
    if (ball.phase === 'flight') {
      ball.phase = 'opening';
      ball.group.position.copy(ball.to);
      return;
    }
    if (ball.phase === 'opening') {
      ball.target.visible = false;
      ball.phase = 'shaking';
      return;
    }
    if (ball.phase === 'shaking') {
      ball.shakeIndex += 1;
      if (ball.shakeIndex < ball.shakes) return;
      this.beginPokeballResult(ball);
      return;
    }
    ball.phase = 'result-done';
  }

  private beginPokeballResult(ball: PokeballArc): void {
    ball.phase = 'result';
    ball.flash.visible = true;
    const color = ball.captured ? '#fef08a' : '#fb7185';
    (ball.flash.material as THREE.MeshBasicMaterial).color.set(color);
    this.spawnBurst(color, ball.captured ? ball.to : ball.target.position.clone().setY(0.9));
    this.rings.push(this.spawnRing(color, ball.captured ? ball.to : ball.target.position.clone().setY(0.8)));
    if (!ball.captured) ball.target.visible = ball.targetWasVisible;
  }

  private spawnBurst(color: string, at: THREE.Vector3): void {
    const style: MoveEffectStyle = {
      color,
      shape: 'star',
      count: 7,
      speed: 2.1,
      size: 0.13,
      lift: 0.9,
      lifetime: 0.55,
    };
    for (let i = 0; i < style.count; i++) this.particles.push(this.spawn(style, at, new THREE.Vector3(0, 0.5, 0)));
  }

  private updateRings(dt: number): void {
    this.rings = this.rings.filter((ring) => {
      ring.age += dt;
      if (ring.age >= ring.lifetime) {
        this.group.remove(ring.mesh);
        (ring.mesh.material as THREE.Material).dispose();
        return false;
      }
      const progress = ring.age / ring.lifetime;
      ring.mesh.scale.setScalar(1 + progress * 2.4);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
      return true;
    });
  }

  private stopDamageReaction(target: THREE.Group): void {
    const current = this.damageReactions.find((reaction) => reaction.slot === target);
    if (!current) return;
    this.finishDamageReaction(current);
    this.damageReactions = this.damageReactions.filter((reaction) => reaction !== current);
  }

  private finishDamageReaction(reaction: DamageReaction): void {
    reaction.slot.position.copy(reaction.basePosition);
    reaction.slot.remove(reaction.light);
  }

  private spawnRing(color: string, at: THREE.Vector3): ImpactRing {
    const mesh = new THREE.Mesh(
      this.ringGeometry,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copy(at);
    this.group.add(mesh);
    return { mesh, age: 0, lifetime: 0.45 };
  }

  private spawn(style: MoveEffectStyle, from: THREE.Vector3, direction: THREE.Vector3): Particle {
    const material = new THREE.MeshBasicMaterial({ color: style.color, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.getGeometry(style.shape), material);
    mesh.scale.setScalar(style.size * (0.6 + Math.random() * 0.8));
    mesh.position.copy(from);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    const spread = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(0.9);
    const velocity = direction.clone().add(spread).multiplyScalar(style.speed * (0.7 + Math.random() * 0.6));
    this.group.add(mesh);
    return { mesh, velocity, age: 0, lifetime: style.lifetime, lift: style.lift };
  }

  private getGeometry(shape: ParticleShape): THREE.BufferGeometry {
    const cached = this.geometries.get(shape);
    if (cached) return cached;
    const geometry = createParticleGeometry(shape);
    this.geometries.set(shape, geometry);
    return geometry;
  }
}

function flashOpacity(flash: THREE.Mesh, opacity: number): void {
  (flash.material as THREE.MeshBasicMaterial).opacity = opacity;
}

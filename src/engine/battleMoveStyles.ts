import * as THREE from 'three';
import type { PokemonType } from '../data/pokemon/species';

export interface MoveEffectStyle {
  color: string;
  shape: ParticleShape;
  count: number;
  speed: number;
  size: number;
  /** Aceleração vertical (positiva sobe, negativa cai). */
  lift: number;
  lifetime: number;
}

export type ParticleShape =
  | 'orb' | 'flame' | 'drop' | 'leaf' | 'bolt' | 'crystal' | 'impact' | 'bubble' | 'clod'
  | 'feather' | 'ripple' | 'wing' | 'stone' | 'wisp' | 'fang' | 'crescent' | 'gear' | 'star';

export const MOVE_EFFECT_STYLES: Partial<Record<PokemonType, MoveEffectStyle>> = {
  normal: { color: '#f8fafc', shape: 'orb', count: 24, speed: 3.0, size: 0.15, lift: 0.0, lifetime: 0.6 },
  fire: { color: '#fb923c', shape: 'flame', count: 40, speed: 3.2, size: 0.16, lift: 1.8, lifetime: 0.8 },
  water: { color: '#38bdf8', shape: 'drop', count: 40, speed: 3.6, size: 0.13, lift: -3.5, lifetime: 0.8 },
  grass: { color: '#4ade80', shape: 'leaf', count: 32, speed: 2.8, size: 0.18, lift: 0.4, lifetime: 0.9 },
  electric: { color: '#facc15', shape: 'bolt', count: 38, speed: 4.4, size: 0.13, lift: 0.2, lifetime: 0.65 },
  ice: { color: '#a5f3fc', shape: 'crystal', count: 34, speed: 3.1, size: 0.14, lift: -0.6, lifetime: 0.85 },
  fighting: { color: '#f97316', shape: 'impact', count: 28, speed: 4.0, size: 0.17, lift: 0.1, lifetime: 0.55 },
  poison: { color: '#c084fc', shape: 'bubble', count: 34, speed: 2.6, size: 0.16, lift: 0.9, lifetime: 0.85 },
  ground: { color: '#d97706', shape: 'clod', count: 32, speed: 2.9, size: 0.18, lift: -2.8, lifetime: 0.75 },
  flying: { color: '#bae6fd', shape: 'feather', count: 30, speed: 4.2, size: 0.14, lift: 1.4, lifetime: 0.7 },
  psychic: { color: '#f472b6', shape: 'ripple', count: 36, speed: 2.7, size: 0.17, lift: 0.5, lifetime: 0.85 },
  bug: { color: '#a3e635', shape: 'wing', count: 30, speed: 3.3, size: 0.13, lift: 0.6, lifetime: 0.75 },
  rock: { color: '#a8a29e', shape: 'stone', count: 26, speed: 3.0, size: 0.2, lift: -3.2, lifetime: 0.7 },
  ghost: { color: '#818cf8', shape: 'wisp', count: 34, speed: 2.2, size: 0.18, lift: 1.2, lifetime: 0.95 },
  dragon: { color: '#6366f1', shape: 'fang', count: 42, speed: 3.8, size: 0.18, lift: 0.8, lifetime: 0.85 },
  dark: { color: '#6d28d9', shape: 'crescent', count: 36, speed: 2.4, size: 0.2, lift: 0.0, lifetime: 0.9 },
  steel: { color: '#cbd5e1', shape: 'gear', count: 28, speed: 3.9, size: 0.14, lift: -0.4, lifetime: 0.65 },
  fairy: { color: '#fbcfe8', shape: 'star', count: 36, speed: 2.8, size: 0.15, lift: 1.1, lifetime: 0.9 },
};

export function getMoveEffectStyle(type: PokemonType): MoveEffectStyle {
  const style = MOVE_EFFECT_STYLES[type] ?? MOVE_EFFECT_STYLES.normal;
  if (!style) throw new Error(`Efeito "normal" ausente para o tipo "${type}".`);
  return style;
}

export function createParticleGeometry(shape: ParticleShape): THREE.BufferGeometry {
  if (shape === 'orb') return new THREE.SphereGeometry(1, 8, 6);
  if (shape === 'flame') return new THREE.ConeGeometry(0.8, 1.7, 5);
  if (shape === 'drop') return new THREE.SphereGeometry(0.75, 8, 6).scale(0.8, 1.5, 0.8);
  if (shape === 'leaf') return new THREE.ShapeGeometry(makeLeafShape());
  if (shape === 'bolt') return new THREE.ShapeGeometry(makeBoltShape());
  if (shape === 'crystal') return new THREE.OctahedronGeometry(0.9, 0);
  if (shape === 'impact') return new THREE.BoxGeometry(1.3, 0.55, 0.45);
  if (shape === 'bubble') return new THREE.TorusGeometry(0.55, 0.13, 5, 10);
  if (shape === 'clod') return new THREE.DodecahedronGeometry(0.75, 0);
  if (shape === 'feather') return new THREE.ShapeGeometry(makeFeatherShape());
  if (shape === 'ripple') return new THREE.TorusKnotGeometry(0.42, 0.12, 48, 5, 2, 3);
  if (shape === 'wing') return new THREE.ShapeGeometry(makeWingShape());
  if (shape === 'stone') return new THREE.IcosahedronGeometry(0.78, 0);
  if (shape === 'wisp') return new THREE.CapsuleGeometry(0.34, 0.65, 4, 6);
  if (shape === 'fang') return new THREE.ConeGeometry(0.48, 1.55, 4);
  if (shape === 'crescent') return new THREE.ShapeGeometry(makeCrescentShape());
  if (shape === 'gear') return new THREE.CylinderGeometry(0.68, 0.68, 0.22, 8, 1, false);
  return new THREE.ShapeGeometry(makeStarShape());
}

function makeLeafShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.7);
  shape.quadraticCurveTo(0.9, -0.2, 0.12, 0.8);
  shape.quadraticCurveTo(-0.8, 0.25, 0, -0.7);
  return shape;
}

function makeBoltShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0.1, 0.9);
  shape.lineTo(-0.6, -0.05);
  shape.lineTo(-0.05, -0.05);
  shape.lineTo(-0.3, -0.9);
  shape.lineTo(0.65, 0.1);
  shape.lineTo(0.12, 0.1);
  shape.closePath();
  return shape;
}

function makeFeatherShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.55, -0.7);
  shape.quadraticCurveTo(0.9, -0.2, 0.4, 0.8);
  shape.quadraticCurveTo(-0.55, 0.45, -0.55, -0.7);
  return shape;
}

function makeWingShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.8, 0);
  shape.quadraticCurveTo(-0.05, 0.95, 0.8, 0.55);
  shape.quadraticCurveTo(0.55, -0.15, -0.8, 0);
  return shape;
}

function makeCrescentShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.8, -Math.PI * 0.65, Math.PI * 0.65, false);
  shape.absarc(0.35, 0, 0.63, Math.PI * 0.65, -Math.PI * 0.65, true);
  return shape;
}

function makeStarShape(): THREE.Shape {
  const shape = new THREE.Shape();
  for (let point = 0; point < 10; point++) {
    const angle = (point / 10) * Math.PI * 2 - Math.PI / 2;
    const radius = point % 2 === 0 ? 0.85 : 0.38;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

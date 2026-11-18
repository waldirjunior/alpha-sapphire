import * as THREE from 'three';
import { characterFaceAnimations, type NativeFaceAnimation } from './nativeAssets';

type Binding = { material: THREE.MeshStandardMaterial; offset: THREE.Vector2; animation: NativeFaceAnimation };
type ExpressionState = { expression: number; bindings: Binding[] };

function isolateMaterial(material: THREE.Material, animations: readonly NativeFaceAnimation[],
  bindings: Map<THREE.Material, Binding>): THREE.Material {
  const previous = bindings.get(material);
  if (previous) return previous.material;
  if (!(material instanceof THREE.MeshStandardMaterial) || !material.map) return material;
  const animation = animations.find(candidate => candidate.material === material.name);
  if (!animation) return material;
  const clone = material.clone();
  clone.map = material.map.clone();
  bindings.set(material, { material: clone, offset: clone.map.offset.clone(), animation });
  return clone;
}

function bindMaterials(root: THREE.Object3D, animations: readonly NativeFaceAnimation[]): Binding[] {
  const bindings = new Map<THREE.Material, Binding>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    node.material = Array.isArray(node.material) ?
      node.material.map(material => isolateMaterial(material, animations, bindings)) :
      isolateMaterial(node.material, animations, bindings);
  });
  return [...bindings.values()];
}

function applyExpression(state: ExpressionState): void {
  for (const { material, offset, animation } of state.bindings) {
    const frame = animation.frames.find(candidate => candidate.frame === state.expression * 10);
    if (!frame || !material.map) throw new Error(`Expressão ${state.expression}: paleta ausente em ${material.name}`);
    material.map.offset.set(offset.x - frame.translation[0], offset.y - frame.translation[1]);
    material.map.updateMatrix();
  }
}

function disposeBindings(bindings: readonly Binding[]): void {
  for (const { material } of bindings) {
    material.map?.dispose();
    material.dispose();
  }
}

export class CharacterExpressions {
  private readonly states = new WeakMap<THREE.Object3D, ExpressionState>();

  constructor(private readonly animations: (url: string) => readonly NativeFaceAnimation[] = characterFaceAnimations) {}

  bind(target: THREE.Object3D, model: THREE.Object3D, url: string): void {
    const previous = this.states.get(target);
    if (previous) disposeBindings(previous.bindings);
    const state = { expression: previous?.expression ?? 0, bindings: bindMaterials(model, this.animations(url)) };
    this.states.set(target, state);
    applyExpression(state);
  }

  set(target: THREE.Object3D, expression = 0): void {
    if (!Number.isInteger(expression) || expression < 0 || expression > 7) {
      throw new RangeError(`Expressão ${expression}: esperado índice inteiro 0..7 de ChangeFace`);
    }
    const state = this.states.get(target) ?? { expression: 0, bindings: [] };
    this.states.set(target, state);
    if (state.expression === expression) return;
    state.expression = expression;
    applyExpression(state);
  }

  clear(parent: THREE.Object3D): void {
    parent.traverse(target => {
      const state = this.states.get(target);
      if (state) disposeBindings(state.bindings);
      this.states.delete(target);
    });
  }
}

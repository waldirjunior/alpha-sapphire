import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CharacterExpressions } from './characterExpressions';

const profiles = [{ material: 'synthetic_face', frames: Array.from({ length: 8 }, (_, id) => ({
  id, frame: id * 10, translation: [-(id % 4) / 4, id >= 4 ? -0.5 : 0],
})) }];

function actor() {
  const root = new THREE.Group();
  const texture = new THREE.Texture();
  texture.flipY = false;
  const faceMaterial = new THREE.MeshStandardMaterial({ name: 'synthetic_face', map: texture });
  const bodyMaterial = new THREE.MeshStandardMaterial({ name: 'body', map: texture });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0.1, 0.8, 0.2, 0.7], 2));
  const face = new THREE.Mesh(geometry, faceMaterial);
  const body = new THREE.Mesh(geometry, bodyMaterial);
  root.add(face, body);
  return { root, face, body, texture, faceMaterial };
}

describe('expressões de material BCH por ator', () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7])('seleciona frame %s0 sem mudar UV, corpo ou outra instância', id => {
    const a = actor();
    const other = a.root.clone();
    const originalUvs = Array.from(a.face.geometry.attributes.uv.array);
    const expressions = new CharacterExpressions(() => profiles);
    expressions.bind(a.root, a.root, 'synthetic');
    expressions.bind(other, other, 'synthetic');
    expressions.set(a.root, id);
    const face = a.face.material;
    expect(face).not.toBe(a.faceMaterial);
    expect(face.map).not.toBe(a.texture);
    expect(face.map?.offset.toArray()).toEqual([(id % 4) / 4, id >= 4 ? 0.5 : 0]);
    expect(face.map?.matrix.elements[6]).toBeCloseTo((id % 4) / 4);
    expect(face.map?.flipY).toBe(false);
    expect(a.body.material.map).toBe(a.texture);
    expect(a.texture.offset.toArray()).toEqual([0, 0]);
    expect(Array.from(a.face.geometry.attributes.uv.array)).toEqual(originalUvs);
    const second = other.children[0];
    expect(second).toBeInstanceOf(THREE.Mesh);
    if (!(second instanceof THREE.Mesh) || !(second.material instanceof THREE.MeshStandardMaterial)) throw new Error('fixture');
    expect(second.material.map?.offset.toArray()).toEqual([0, 0]);
  });

  it('aplica a expressão pedida antes da carga e preserva o offset-base', () => {
    const a = actor();
    a.texture.offset.set(0.01, 0.02);
    const expressions = new CharacterExpressions(() => profiles);
    expressions.set(a.root, 1);
    expressions.bind(a.root, a.root, 'synthetic');
    expect(a.face.material.map?.offset.toArray()).toEqual([0.26, 0.02]);
    expressions.set(a.root, 0);
    expect(a.face.material.map?.offset.toArray()).toEqual([0.01, 0.02]);
  });

  it('descarta só clones e não reaplica estado de uma zona descartada', () => {
    const a = actor();
    const parent = new THREE.Group();
    parent.add(a.root);
    const originalDispose = vi.spyOn(a.texture, 'dispose');
    const expressions = new CharacterExpressions(() => profiles);
    expressions.bind(a.root, a.root, 'synthetic');
    const cloned = a.face.material.map!;
    const clonedDispose = vi.spyOn(cloned, 'dispose');
    expressions.set(a.root, 1);
    expressions.clear(parent);
    expect(clonedDispose).toHaveBeenCalledOnce();
    expect(originalDispose).not.toHaveBeenCalled();
    const fresh = actor();
    expressions.bind(a.root, fresh.root, 'synthetic');
    expect(fresh.face.material.map?.offset.toArray()).toEqual([0, 0]);
  });

  it('abstém-se sem material evidenciado e recusa frames fora do switch', () => {
    const a = actor();
    const expressions = new CharacterExpressions(() => []);
    expressions.bind(a.root, a.root, 'unknown');
    expressions.set(a.root, 1);
    expect(a.face.material).toBe(a.faceMaterial);
    expect(() => expressions.set(a.root, 8)).toThrow('8');
    expect(() => expressions.set(a.root, -1)).toThrow('-1');
  });
});

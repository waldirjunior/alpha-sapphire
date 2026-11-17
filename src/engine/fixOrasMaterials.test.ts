import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fixOrasMaterials } from './SceneManager';

function meshWith(material: THREE.MeshStandardMaterial): THREE.Mesh {
  return new THREE.Mesh(new THREE.BufferGeometry(), material);
}

function textured(name: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ name });
  mat.map = new THREE.Texture();
  return mat;
}

describe('fixOrasMaterials (P-007)', () => {
  it('preserva o recorte MASK do PICA em vez de forçar alphaTest 0.45', () => {
    const mat = textured('t01_01');
    mat.userData = { pica: true };
    mat.alphaTest = 0.004;
    fixOrasMaterials(meshWith(mat));
    expect(mat.alphaTest).toBe(0.004);
    expect(mat.transparent).toBe(false);
  });

  it('desliga depthWrite em materiais BLEND do PICA', () => {
    const mat = textured('shadow1');
    mat.userData = { pica: true };
    mat.transparent = true;
    fixOrasMaterials(meshWith(mat));
    expect(mat.depthWrite).toBe(false);
    expect(mat.transparent).toBe(true);
  });

  it('mantém a heurística antiga para modelos sem metadado PICA', () => {
    const body = textured('body');
    const shadow = textured('kage_01');
    fixOrasMaterials(meshWith(body));
    fixOrasMaterials(meshWith(shadow));
    expect(body.alphaTest).toBe(0.45);
    expect(shadow.transparent).toBe(true);
    expect(shadow.depthWrite).toBe(false);
  });

  it('usa piso sRGB e dupla face em todos os materiais', () => {
    const mat = textured('t01_02');
    fixOrasMaterials(meshWith(mat));
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mat.map?.colorSpace).toBe(THREE.SRGBColorSpace);
  });
});

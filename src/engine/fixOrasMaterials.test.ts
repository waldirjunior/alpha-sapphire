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
  it('restaura alpha test junto com o blend nativo comprovado', () => {
    const mat = textured('leaves');
    mat.userData = { pica: true, picaAlpha: { cutoff: 52 / 255, blend: 'source-alpha', alphaBlend: 'source-alpha', depthWrite: false } };
    mat.transparent = true;
    fixOrasMaterials(meshWith(mat));
    expect(mat.alphaTest).toBe(52 / 255);
    expect(mat.blendSrcAlpha).toBe(THREE.SrcAlphaFactor);
  });
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

  it('preserva OPAQUE, MASK e BLEND dos GLBs Pokémon sem impor recorte legado', () => {
    const opaque = textured('BodyAVco00');
    const mask = textured('cutout');
    const blend = textured('translucent');
    mask.alphaTest = 0.2;
    blend.transparent = true;
    const root = new THREE.Group();
    root.add(meshWith(opaque), meshWith(mask), meshWith(blend));
    fixOrasMaterials(root, true);
    expect(opaque.alphaTest).toBe(0);
    expect(opaque.transparent).toBe(false);
    expect(mask.alphaTest).toBe(0.2);
    expect(blend.transparent).toBe(true);
    expect(blend.depthWrite).toBe(false);
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

  it('zera emissiveFactor branco sem emissiveTexture para não estourar texturas de interiores', () => {
    const washed = textured('Comb10');
    washed.emissive = new THREE.Color(1, 1, 1);
    fixOrasMaterials(meshWith(washed));
    expect(washed.emissive.getHex()).toBe(0x000000);

    const untextured = new THREE.MeshStandardMaterial({ name: 'glow', emissive: new THREE.Color(1, 1, 1) });
    fixOrasMaterials(meshWith(untextured));
    expect(untextured.emissive.getHex()).toBe(0xffffff);
  });
});

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyNativePicaAlpha, picaMaterialModelUrl } from './picaMaterials';
import catalog from '../data/picaMaterials.json';

function material(blend: string, alphaBlend = blend): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial();
  result.userData.picaAlpha = { cutoff: 52 / 255, blend, alphaBlend, depthWrite: false };
  return result;
}

describe('proven PICA alpha subset', () => {
  it('selects only published immutable aliases without changing unsupported URLs', () => {
    for (const [source, target] of Object.entries(catalog.models)) {
      expect(picaMaterialModelUrl(source)).toBe(target);
      expect(target).toMatch(/^\/assets\/native\/materials\/[a-z0-9_]+-[a-f0-9]{12}\.glb$/);
    }
    expect(picaMaterialModelUrl('/assets/unknown.glb')).toBe('/assets/unknown.glb');
  });

  it('keeps the native cutout even when RGB blending is enabled', () => {
    const mat = material('source-alpha');
    expect(applyNativePicaAlpha(mat)).toBe(true);
    expect(mat.alphaTest).toBe(52 / 255);
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.blending).toBe(THREE.CustomBlending);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(mat.blendSrcAlpha).toBe(THREE.SrcAlphaFactor);
  });

  it('does not replace native alpha blend factors with the Three default', () => {
    const mat = material('source-alpha', 'replace');
    applyNativePicaAlpha(mat);
    expect(mat.blendSrcAlpha).toBe(THREE.OneFactor);
    expect(mat.blendDstAlpha).toBe(THREE.ZeroFactor);
    const mask = material('replace');
    mask.userData.picaAlpha.depthWrite = true;
    applyNativePicaAlpha(mask);
    expect(mask.transparent).toBe(false);
    expect(mask.depthWrite).toBe(true);
    expect(mask.blendSrc).toBe(THREE.OneFactor);
    expect(mask.blendDst).toBe(THREE.ZeroFactor);
  });

  it('leaves unsupported or malformed metadata unchanged', () => {
    for (const value of [null, {}, { cutoff: NaN }, { cutoff: 0.2, blend: 'add', alphaBlend: 'replace', depthWrite: true }]) {
      const mat = new THREE.MeshStandardMaterial();
      mat.userData.picaAlpha = value;
      expect(applyNativePicaAlpha(mat)).toBe(false);
      expect(mat.alphaTest).toBe(0);
      expect(mat.blending).toBe(THREE.NormalBlending);
    }
  });
});

import * as THREE from 'three';
import catalog from '../data/picaMaterials.json';

const materialModels: Record<string, string> = catalog.models;

export function picaMaterialModelUrl(url: string): string {
  return materialModels[url] ?? url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function applyNativePicaAlpha(material: THREE.MeshStandardMaterial): boolean {
  const profile: unknown = material.userData.picaAlpha;
  if (!isRecord(profile) || typeof profile.cutoff !== 'number' || !Number.isFinite(profile.cutoff) ||
      profile.cutoff < 0 || typeof profile.depthWrite !== 'boolean' ||
      (profile.blend !== 'replace' && profile.blend !== 'source-alpha') ||
      (profile.alphaBlend !== 'replace' && profile.alphaBlend !== 'source-alpha')) return false;
  material.alphaTest = profile.cutoff;
  material.transparent = profile.blend === 'source-alpha';
  material.depthWrite = profile.depthWrite;
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendEquationAlpha = THREE.AddEquation;
  material.blendSrc = material.transparent ? THREE.SrcAlphaFactor : THREE.OneFactor;
  material.blendDst = material.transparent ? THREE.OneMinusSrcAlphaFactor : THREE.ZeroFactor;
  material.blendSrcAlpha = profile.alphaBlend === 'source-alpha' ? THREE.SrcAlphaFactor : THREE.OneFactor;
  material.blendDstAlpha = profile.alphaBlend === 'source-alpha' ? THREE.OneMinusSrcAlphaFactor : THREE.ZeroFactor;
  return true;
}

function applyPicaAlphaState(mat: THREE.MeshStandardMaterial): void {
  if (applyNativePicaAlpha(mat)) return;
  if (mat.transparent) mat.depthWrite = false;
}

function applyLegacyAlphaState(mat: THREE.MeshStandardMaterial): void {
  if (!mat.map) return;
  if (/kage|shadow/i.test(mat.name)) {
    mat.transparent = true;
    mat.alphaTest = 0.02;
    mat.depthWrite = false;
    return;
  }
  mat.alphaTest = 0.45;
  mat.transparent = false;
}

export function fixOrasMaterials(root: THREE.Object3D, preserveGltfAlpha = false): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      mat.side = THREE.DoubleSide;
      mat.roughness = 0.92;
      mat.metalness = 0.0;
      if (mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        if (!mat.emissiveMap) mat.emissive.setScalar(0);
      }
      if (preserveGltfAlpha || mat.userData.pica === true) applyPicaAlphaState(mat);
      else applyLegacyAlphaState(mat);
      mat.needsUpdate = true;
    }
  });
}

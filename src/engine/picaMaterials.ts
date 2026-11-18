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

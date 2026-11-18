import catalog from '../data/nativeAssets.json';

export interface NativeFaceAnimation {
  material: string;
  frames: readonly { frame: number; translation: readonly number[] }[];
}
const models: readonly { url: string; faceAnimations?: readonly NativeFaceAnimation[] }[] = catalog.models;

export function characterFaceAnimations(url: string): readonly NativeFaceAnimation[] {
  return models.find(model => model.url === characterModelUrl(url))?.faceAnimations ?? [];
}

const pokemon: Readonly<Record<string, string>> = catalog.pokemon;
const characters: Readonly<Record<string, string>> = catalog.characters;

export function pokemonModelUrl(speciesId: string): string {
  return pokemon[speciesId] ?? `/assets/pokemon/${speciesId}/${speciesId}.glb`;
}

export function characterModelUrl(url: string): string {
  return characters[url] ?? url;
}

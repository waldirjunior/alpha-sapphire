import catalog from '../data/nativeAssets.json';

const pokemon: Readonly<Record<string, string>> = catalog.pokemon;
const characters: Readonly<Record<string, string>> = catalog.characters;

export function pokemonModelUrl(speciesId: string): string {
  return pokemon[speciesId] ?? `/assets/pokemon/${speciesId}/${speciesId}.glb`;
}

export function characterModelUrl(url: string): string {
  return characters[url] ?? url;
}

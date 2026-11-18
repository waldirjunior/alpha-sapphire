import { describe, expect, it } from 'vitest';
import { characterModelUrl, pokemonModelUrl } from './nativeAssets';
import { listRosterSpecies } from '../data/pokemon/species';
import catalog from '../data/nativeAssets.json';

describe('native asset catalog', () => {
  it('uses the promoted species URL rather than guessing an internal model tag', () => {
    expect(pokemonModelUrl('clauncher')).toMatch(/^\/assets\/native\/pokemon\/clauncher-[a-f0-9]{12}\.glb$/);
  });

  it('resolves the player alias to the same promoted MM model as zone actors', () => {
    expect(characterModelUrl('/assets/characters/brendan/brendan.glb'))
      .toBe(characterModelUrl('/assets/characters/mm_0315.glb'));
  });

  it('keeps explicit old paths when no promoted model exists', () => {
    expect(characterModelUrl('/assets/characters/mm_9999.glb')).toBe('/assets/characters/mm_9999.glb');
    expect(pokemonModelUrl('missing')).toBe('/assets/pokemon/missing/missing.glb');
  });

  it('exposes every promoted species/form, including the recorded legacy fallback', () => {
    const ids = listRosterSpecies().map((species) => species.id);
    expect(ids.sort()).toEqual(Object.keys(catalog.pokemon).sort());
    expect(ids).toContain('taillow');
    expect(ids).toContain('groudon-1');
    expect(catalog.models.find((model) => model.id === 'pokemon/0276/0')?.native).toBe(false);
  });
});

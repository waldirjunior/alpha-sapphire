import { describe, expect, it } from 'vitest';
import { characterFaceAnimations, characterModelUrl, pokemonModelUrl } from './nativeAssets';
import { listRosterSpecies } from '../data/pokemon/species';
import catalog from '../data/nativeAssets.json';

describe('native asset catalog', () => {
  it('resolves every mapped character used in zones 6 through 16 without guessing special IDs', () => {
    const zones = import.meta.glob<{ npcs: { model: number }[] }>(
      '../data/maps_v2/00{06,07,08,09,10,11,12,13,14,15,16}.json', { eager: true, import: 'default' });
    expect(Object.keys(zones)).toHaveLength(11);
    for (const zone of Object.values(zones)) for (const npc of zone.npcs) {
      const url = `/assets/characters/mm_${String(npc.model).padStart(4, '0')}.glb`;
      if (npc.model < 544) {
        expect(characterModelUrl(url)).toMatch(/^\/assets\/native\/characters\/mm_\d{4}-[a-f0-9]{12}\.glb$/);
        const model = catalog.models.find(row => row.url === characterModelUrl(url));
        expect(model).toBeDefined();
        if (model?.native) expect(model.clips).toEqual(expect.arrayContaining(['overworld_000', 'overworld_002']));
      } else {
        expect(characterModelUrl(url)).toBe(url);
        expect(catalog.unavailable.some(row => row.id === `character/mm_${npc.model}`)).toBe(true);
      }
    }
  });

  it('keeps complete material palettes limited to evidenced immutable GLBs and their aliases', () => {
    for (const model of ['0180', '0181', '0182', '0212', '0314', '0315']) {
      const profiles = characterFaceAnimations(`/assets/characters/mm_${model}.glb`);
      expect(profiles).toHaveLength(1);
      expect(profiles[0].frames.map(frame => frame.frame)).toEqual([0, 10, 20, 30, 40, 50, 60, 70]);
    }
    expect(characterFaceAnimations('/assets/characters/brendan/brendan.glb'))
      .toBe(characterFaceAnimations('/assets/characters/mm_0315.glb'));
    expect(characterFaceAnimations('/assets/native/characters/mm_0180-846abfc5891a.glb')).toEqual([]);
    expect(characterFaceAnimations('/assets/characters/mm_0045.glb')).toEqual([]);
  });

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

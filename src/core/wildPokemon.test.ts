import { describe, expect, it } from 'vitest';
import { MAP_ENCOUNTERS } from '../data/pokemon/route101';
import { fromTables, getBattleTables, loadBattleTables, registerBattleTables, type BattleTableLoader } from './battleTables';
import { getSpeciesById } from './dex';
import { MAX_IV } from './statSpread';
import {
  buildZoneEncounterTables,
  createSeededRng,
  generatePokemon,
  grassTableFromZone,
  mapIdForZoneName,
  resolveEncounterTable,
  type ZoneEncounterSource,
} from './wildPokemon';

const slot = (species: number, levelMin: number, levelMax = levelMin) => ({ species, form: 0, levelMin, levelMax });

// Fixture sintética com o formato de src/data/zones/*.json (A-009): grama, separador species=0, depois surf.
const ROUTE_101: ZoneEncounterSource = {
  name: 'Route 101',
  encounters: [slot(265, 2), slot(265, 2), slot(263, 2), slot(261, 2), slot(261, 3), slot(0, 1), slot(129, 10)],
};
const ROSTER_BY_DEX = new Map([[261, 'poochyena'], [263, 'zigzagoon'], [265, 'wurmple']]);
const resolveAll = (dex: number): string | null => ROSTER_BY_DEX.get(dex) ?? null;

describe('seeded generation of wild and trainer Pokémon', () => {
  it('produces the same sequence for the same seed and different ones for other seeds', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const sequence = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sequence);
    expect(createSeededRng(7)()).not.toBe(sequence[0]);
    expect(sequence.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('rolls IVs, nature and personality reproducibly and reflects them in stats', () => {
    const species = getSpeciesById('poochyena');
    const first = generatePokemon(species, 20, createSeededRng(1));
    const again = generatePokemon(species, 20, createSeededRng(1));
    expect(again).toEqual(first);
    expect(Object.values(first.ivs).every((iv) => iv >= 0 && iv <= MAX_IV)).toBe(true);
    expect(first.nature).toBeGreaterThanOrEqual(0);
    expect(first.nature).toBeLessThan(25);
    const flat = generatePokemon(species, 20, () => 0);
    expect(flat.ivs.hp).toBe(0);
    expect(generatePokemon(species, 20, () => 0.999999).maxHp).toBeGreaterThan(flat.maxHp);
  });
});

describe('zone encounter adapter (src/data/zones)', () => {
  it('reads only the grass sub-table and aggregates repeated slots as weight', () => {
    expect(grassTableFromZone(ROUTE_101, resolveAll)).toEqual([
      { speciesId: 'wurmple', minLevel: 2, maxLevel: 2, weight: 2 },
      { speciesId: 'zigzagoon', minLevel: 2, maxLevel: 2, weight: 1 },
      { speciesId: 'poochyena', minLevel: 2, maxLevel: 2, weight: 1 },
      { speciesId: 'poochyena', minLevel: 3, maxLevel: 3, weight: 1 },
    ]);
  });

  it('drops species the resolver rejects and maps zone names to map ids', () => {
    const onlyWurmple = (dex: number) => (dex === 265 ? 'wurmple' : null);
    expect(grassTableFromZone(ROUTE_101, onlyWurmple)).toEqual([{ speciesId: 'wurmple', minLevel: 2, maxLevel: 2, weight: 2 }]);
    expect(mapIdForZoneName('Route 101')).toBe('route_101');
    expect(mapIdForZoneName('Littleroot Town')).toBe('littleroot_town');
  });

  it('keeps the first zone with grass per map and falls back to the bundled table', () => {
    const empty: ZoneEncounterSource = { name: 'Route 101', encounters: [slot(0, 1)] };
    const tables = buildZoneEncounterTables([empty, ROUTE_101], resolveAll);
    expect(Object.keys(tables)).toEqual(['route_101']);
    expect(resolveEncounterTable('route_101', tables, MAP_ENCOUNTERS)).toBe(tables.route_101);
    expect(resolveEncounterTable('route_102', tables, MAP_ENCOUNTERS)).toBe(MAP_ENCOUNTERS.route_102);
    expect(resolveEncounterTable('petalburg_city', tables, MAP_ENCOUNTERS)).toBeUndefined();
  });
});

describe('injected battle table loader (ADR-004)', () => {
  it('loads once, shares the cache and rebuilds derived values only when tables change', async () => {
    const original = getBattleTables();
    let builds = 0;
    const derived = fromTables((tables) => {
      builds += 1;
      return tables.moves.length;
    });
    expect([derived(), derived()]).toEqual([original.moves.length, original.moves.length]);
    expect(builds).toBe(1);
    try {
      registerBattleTables({ ...original, moves: original.moves.slice(0, 10) });
      expect(derived()).toBe(10);
      expect(builds).toBe(2);
    } finally {
      registerBattleTables(original);
    }
    const untouched: BattleTableLoader = {
      species: () => Promise.reject(new Error('não deveria recarregar')),
      moves: () => Promise.reject(new Error('não deveria recarregar')),
      types: () => Promise.reject(new Error('não deveria recarregar')),
      learnsets: () => Promise.reject(new Error('não deveria recarregar')),
      machines: () => Promise.reject(new Error('não deveria recarregar')),
      evolutions: () => Promise.reject(new Error('não deveria recarregar')),
      natures: () => Promise.reject(new Error('não deveria recarregar')),
    };
    await expect(loadBattleTables(untouched)).resolves.toBe(original);
  });
});

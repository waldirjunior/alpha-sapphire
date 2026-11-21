import { describe, expect, it } from 'vitest';
import { MAP_ENCOUNTERS } from '../data/pokemon/route101';
import { fromTables, getBattleTables, loadBattleTables, registerBattleTables, type BattleTableLoader } from './battleTables';
import { getSpeciesById } from './dex';
import { MAX_IV } from './statSpread';
import {
  buildZoneEncounterTables,
  buildZoneEncounterSources,
  createSeededRng,
  encounterMethodForTile,
  encounterSubtableFromZone,
  encounterTableFromZone,
  generatePokemon,
  grassTableFromZone,
  mapIdForZoneName,
  resolveEncounterTable,
  resolveEncounterTableForMethod,
  rollHordeEncounter,
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
  it('uses ROM slot rates and keeps surf and fishing subtables separate from grass', () => {
    const encounters = Array.from({ length: 61 }, () => slot(0, 0));
    encounters[0] = slot(261, 2);
    encounters[9] = slot(261, 2);
    encounters[10] = slot(263, 2);
    encounters[11] = slot(265, 2);
    encounters[27] = slot(261, 3);
    encounters[37] = slot(261, 4);
    encounters[46] = slot(261, 5);
    const source: ZoneEncounterSource = {
      name: 'Route 101',
      encounterFormat: 'oras-61-slot-v1',
      encounters,
    };
    const resolveNonzero = (dex: number): string | null => {
      if (dex === 0) throw new Error('slot ORAS vazio não deve ser resolvido');
      return ROSTER_BY_DEX.get(dex) ?? null;
    };

    expect(grassTableFromZone(source, resolveNonzero)).toEqual([
      { speciesId: 'poochyena', minLevel: 2, maxLevel: 2, weight: 15 },
      { speciesId: 'zigzagoon', minLevel: 2, maxLevel: 2, weight: 4 },
      { speciesId: 'wurmple', minLevel: 2, maxLevel: 2, weight: 1 },
    ]);
    expect(encounterTableFromZone(source, 'surf', resolveNonzero)).toEqual([
      { speciesId: 'poochyena', minLevel: 3, maxLevel: 3, weight: 50 },
    ]);
    expect(encounterTableFromZone(source, 'old_rod', resolveNonzero)).toEqual([
      { speciesId: 'poochyena', minLevel: 4, maxLevel: 4, weight: 60 },
    ]);
    const grassRates = [10, 10, 10, 10, 10, 10, 10, 10, 10, 5, 4, 1];
    expect(encounterSubtableFromZone(source, 'grass').slots.map(({ slotRate }) => slotRate)).toEqual(grassRates);
    expect(encounterSubtableFromZone(source, 'tall_grass').slots.map(({ slotRate }) => slotRate)).toEqual(grassRates);
    expect(encounterSubtableFromZone(source, 'surf').slots.map(({ slotRate }) => slotRate)).toEqual([50, 30, 15, 4, 1]);
    expect(encounterSubtableFromZone(source, 'rock_smash').slots.map(({ slotRate }) => slotRate)).toEqual([50, 30, 15, 4, 1]);
    for (const method of ['old_rod', 'good_rod', 'super_rod'] as const) {
      expect(encounterSubtableFromZone(source, method).slots.map(({ slotRate }) => slotRate)).toEqual([60, 35, 5]);
    }
    const horde = encounterSubtableFromZone(source, 'horde_a');
    expect(horde.tableRate).toBe(60);
    expect(horde.slots).toHaveLength(5);
    expect(horde.slots[0]).toMatchObject({ slotIndex: 46, methodSlot: 0, slotRate: null });
    expect(encounterSubtableFromZone(source, 'horde_b').tableRate).toBe(35);
    expect(encounterSubtableFromZone(source, 'horde_c').tableRate).toBe(5);
    expect(encounterSubtableFromZone(source, 'swarm').slots).toHaveLength(3);
    expect(encounterTableFromZone(source, 'swarm', resolveAll)).toEqual([]);
  });

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

  it('resolves Surf and fishing methods from the matching zone source', () => {
    const encounters = Array.from({ length: 61 }, () => slot(0, 0));
    encounters[27] = slot(261, 3);
    encounters[41] = slot(263, 4);
    encounters[43] = slot(265, 5);
    const zone: ZoneEncounterSource = { name: 'Route 101', encounterFormat: 'oras-61-slot-v1', encounters };
    const sources = buildZoneEncounterSources([zone]);

    expect(resolveEncounterTableForMethod('route_101', 'surf', sources, resolveAll)).toEqual([
      { speciesId: 'poochyena', minLevel: 3, maxLevel: 3, weight: 50 },
    ]);
    expect(resolveEncounterTableForMethod('route_101', 'good_rod', sources, resolveAll)).toEqual([
      { speciesId: 'zigzagoon', minLevel: 4, maxLevel: 4, weight: 35 },
    ]);
  });

  it('selects a tile encounter method from grass and Surf terrain metadata', () => {
    const map = {
      id: 'route_101', name: 'Route 101', width: 4, height: 3,
      terrain: [[0, 0, 0, 0], [0, 2, 0, 0], [0, 0, 0, 0]],
      surfTiles: [{ x: 2, z: 1 }],
    };
    expect(encounterMethodForTile(map, { x: 1, z: 1 })).toBe('grass');
    expect(encounterMethodForTile(map, { x: 2, z: 1 })).toBe('surf');
    expect(encounterMethodForTile(map, { x: 0, z: 0 })).toBeNull();
    expect(encounterMethodForTile(map, { x: 4, z: 0 })).toBeNull();
  });

  it('rolls the 60/35/5 horde subtables and a species from each five-slot table', () => {
    const encounters = Array.from({ length: 61 }, () => slot(0, 0));
    encounters[46] = slot(261, 5);
    encounters[51] = slot(263, 6);
    encounters[56] = slot(265, 7);
    const zone: ZoneEncounterSource = { name: 'Route 101', encounterFormat: 'oras-61-slot-v1', encounters };
    const roll = (values: number[]) => {
      let index = 0;
      return () => values[index++] ?? 0;
    };

    expect(rollHordeEncounter(zone, resolveAll, roll([0.59, 0, 0]))).toEqual({
      method: 'horde_a', speciesId: 'poochyena', level: 5,
    });
    expect(rollHordeEncounter(zone, resolveAll, roll([0.6, 0, 0]))?.method).toBe('horde_b');
    expect(rollHordeEncounter(zone, resolveAll, roll([0.95, 0, 0]))?.method).toBe('horde_c');
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

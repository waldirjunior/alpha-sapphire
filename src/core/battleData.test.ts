import { describe, expect, it } from 'vitest';
import { MOVES, SPECIES } from '../data/pokemon/species';
import { getMoveById, getMoveByName, getSpeciesByDex, getSpeciesById, getSpeciesByPersonalIndex } from './dex';
import {
  canLearnMove,
  findLearnMethods,
  getDefaultMoveset,
  getLevelUpLearnset,
  getMachineMoves,
  getMovesLearnedAtLevel,
} from './learnsets';
import { getTypeEffectivenessAgainst, getTypeMultiplier, toElementalType } from './typeChart';

const moveId = (name: string): number => getMoveByName(name).id;

describe('typeChart (DllBattle.cro)', () => {
  it('reads single multipliers from the ROM chart', () => {
    expect(getTypeMultiplier('fire', 'grass')).toBe(2);
    expect(getTypeMultiplier('dragon', 'fairy')).toBe(0);
    expect(getTypeMultiplier('electric', 'ground')).toBe(0);
    expect(getTypeMultiplier('steel', 'steel')).toBe(0.5);
    expect(getTypeMultiplier('normal', 'normal')).toBe(1);
  });

  it('multiplies dual types and ignores duplicated monotype slots', () => {
    expect(getTypeEffectivenessAgainst('ice', ['dragon', 'flying'])).toBe(4);
    expect(getTypeEffectivenessAgainst('water', ['water', 'grass'])).toBe(0.25);
    expect(getTypeEffectivenessAgainst('fire', ['grass', 'grass'])).toBe(2);
  });

  it('normalizes ROM type names and rejects unknown ones', () => {
    expect(toElementalType('Psychic')).toBe('psychic');
    expect(() => toElementalType('Sound')).toThrow(/Tipo desconhecido: "Sound"/);
  });
});

describe('dex (personal + moves)', () => {
  it('looks up Treecko by dex number with real base stats', () => {
    const treecko = getSpeciesByDex(252);
    expect(treecko.name).toBe('Treecko');
    expect(treecko.types).toEqual(['grass']);
    expect(treecko.baseStats).toEqual({ hp: 40, atk: 45, def: 35, spa: 65, spd: 55, spe: 70 });
    expect(treecko.abilities).toEqual(['Overgrow', 'Overgrow', 'Unburden']);
    expect(treecko.growthRate).toBe('medium_slow');
  });

  it('resolves alternate forms past the national dex', () => {
    const megaSceptile = getSpeciesByDex(254, 1);
    expect(megaSceptile.personalIndex).toBeGreaterThan(721);
    expect(megaSceptile.types).toEqual(['grass', 'dragon']);
    expect(getSpeciesByPersonalIndex(megaSceptile.personalIndex)).toBe(megaSceptile);
  });

  it('looks up moves by id and by name variants', () => {
    const tackle = getMoveById(33);
    expect(tackle).toMatchObject({ name: 'Tackle', type: 'normal', category: 'physical', power: 50, accuracy: 100, pp: 35 });
    expect(getMoveByName('water_gun')).toBe(getMoveByName('Water Gun'));
    expect(getMoveByName('Quick Attack').priority).toBe(1);
  });

  it('throws with the offending identifier on unknown lookups', () => {
    expect(() => getSpeciesByDex(999)).toThrow(/dex 999 forma 0/);
    expect(() => getSpeciesByPersonalIndex(5000)).toThrow(/5000/);
    expect(() => getMoveById(9999)).toThrow(/id 9999/);
    expect(() => getMoveByName('Hyper Mega Beam')).toThrow(/Hyper Mega Beam/);
  });
});

describe('learnsets (level-up + TM/HM)', () => {
  const treecko = getSpeciesByDex(252);

  it('lists level-up moves in ROM order', () => {
    expect(getLevelUpLearnset(treecko).slice(0, 4)).toEqual([
      { level: 1, move: moveId('Pound') },
      { level: 1, move: moveId('Leer') },
      { level: 5, move: moveId('Absorb') },
      { level: 9, move: moveId('Quick Attack') },
    ]);
    expect(getMovesLearnedAtLevel(treecko, 5)).toEqual([moveId('Absorb')]);
    expect(getMovesLearnedAtLevel(treecko, 6)).toEqual([]);
  });

  it('builds the Gen VI default moveset from the last four level-up moves', () => {
    expect(getDefaultMoveset(treecko, 5)).toEqual([moveId('Pound'), moveId('Leer'), moveId('Absorb')]);
    expect(getDefaultMoveset(treecko, 13)).toEqual(['Leer', 'Absorb', 'Quick Attack', 'Mega Drain'].map(moveId));
  });

  it('maps TM/HM compatibility to move ids', () => {
    const { hm } = getMachineMoves(getSpeciesByDex(260));
    expect(hm).toContain(moveId('Surf'));
    expect(hm).toContain(moveId('Dive'));
  });

  it('validates whether a species can learn a move and by which method', () => {
    expect(findLearnMethods(treecko, moveId('Absorb'))).toEqual(['level-up']);
    expect(findLearnMethods(getSpeciesByDex(260), moveId('Surf'))).toEqual(['hm']);
    expect(canLearnMove(treecko, moveId('Ember'))).toBe(false);
  });
});

describe('roster derived from the ROM', () => {
  it('resolves every roster species by stable slug and keeps slugs unique', () => {
    expect(SPECIES.treecko.baseStats).toEqual({ hp: 40, atk: 45, def: 35, spa: 65, spd: 55, spe: 70 });
    expect(getSpeciesById('sceptile-1').types).toEqual(['grass', 'dragon']);
    expect(getSpeciesById('nidoranf').dexNumber).toBe(29);
    expect(getSpeciesById('nidoranm').dexNumber).toBe(32);
    expect(() => getSpeciesById('missingno')).toThrow(/missingno/);
  });

  it('exposes move effect fields straight from the ROM', () => {
    expect(MOVES.disarming_voice.accuracy).toBe(101);
    expect(getMoveByName('Struggle').healPercent).toBe(-25);
    expect(getMoveByName('Recover').healPercent).toBe(50);
    expect(getMoveByName('Absorb').recoilPercent).toBe(50);
    expect(getMoveByName('Take Down').recoilPercent).toBe(-25);
    expect(getMoveByName('Toxic')).toMatchObject({ inflict: 5, turnMax: 15 });
  });
});

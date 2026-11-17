import { describe, expect, it } from 'vitest';
import { createPokemonInstance, executeBattleTurn, startWildBattle, type PokemonInstance } from './battle';
import { getMoveByName, getSpeciesById } from './dex';
import { checkLevelUpEvolution, evolveAfterBattle, getEvolutionRules, timeOfDayFromHour, useEvolutionItem, type EvolutionContext } from './evolution';
import { expYield, totalExpForLevel } from './experience';
import { applyNature, getNature } from './natures';
import { addEvs, calculateStats, rollIvs, rollNature, validateSpread, ZERO_SPREAD } from './statSpread';

const always = (value: number) => () => value;
const moveIds = (...names: string[]) => names.map((name) => getMoveByName(name).id);
const DAY: EvolutionContext = { timeOfDay: 'day', partyDexNumbers: [] };
const NIGHT: EvolutionContext = { timeOfDay: 'night', partyDexNumbers: [] };

function pokemon(id: string, level: number, ...moves: string[]): PokemonInstance {
  return createPokemonInstance(getSpeciesById(id), level, moveIds(...moves));
}

describe('Gen VI stat formula with IVs, EVs and natures', () => {
  it('matches the Bulbapedia Garchomp Lv.78 Adamant reference spread', () => {
    const garchomp = getSpeciesById('garchomp').baseStats;
    const ivs = { hp: 24, atk: 12, def: 30, spa: 16, spd: 23, spe: 5 };
    const evs = { hp: 74, atk: 190, def: 91, spa: 48, spd: 84, spe: 23 };
    const adamant = 3;
    expect(getNature(adamant).name).toBe('Adamant');
    expect(calculateStats(garchomp, 78, ivs, evs, adamant)).toEqual({
      maxHp: 289, attack: 278, defense: 193, spAtk: 135, spDef: 171, speed: 171,
    });
  });

  it('keeps zero IV/EV neutral-nature instances on the previous base formula', () => {
    expect(pokemon('torchic', 5, 'Scratch')).toMatchObject({ maxHp: 19, nature: 0, ivs: ZERO_SPREAD, evs: ZERO_SPREAD });
  });

  it('applies nature boosts and drops with integer math', () => {
    expect(applyNature(50, 15, 'spa')).toBe(55);
    expect(applyNature(50, 15, 'atk')).toBe(45);
    expect(applyNature(50, 15, 'def')).toBe(50);
    expect(getNature(12)).toMatchObject({ name: 'Serious', increased: null, decreased: null });
  });

  it('caps EVs at 252 per stat and 510 total and rejects invalid spreads', () => {
    const nearCap = { hp: 252, atk: 252, def: 4, spa: 0, spd: 0, spe: 0 };
    expect(addEvs(nearCap, { hp: 3, atk: 0, def: 0, spa: 0, spd: 0, spe: 3 })).toEqual({ ...nearCap, spe: 2 });
    expect(() => validateSpread({ ...ZERO_SPREAD, atk: 32 }, 'IV')).toThrow(/IV inválido em atk: 32/);
    expect(() => validateSpread({ ...ZERO_SPREAD, hp: 252, atk: 252, def: 10 }, 'EV')).toThrow(/514 excede 510/);
  });

  it('rolls IVs and nature from the injected RNG', () => {
    expect(rollIvs(always(0.999999))).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
    expect(rollNature(always(0))).toBe(0);
    expect(rollNature(always(0.99))).toBe(24);
  });
});

describe('EV yield, Exp. Share and Lucky Egg on KO', () => {
  const fragileWurmple = () => ({ ...pokemon('wurmple', 2, 'String Shot'), currentHp: 1 });

  it('grants the defeated species EV yield and refreshes stats immediately', () => {
    const lead = pokemon('treecko', 30, 'Pound');
    const won = executeBattleTurn(startWildBattle(lead, fragileWurmple()), 0, always(0.5));
    expect(won.status).toBe('victory');
    expect(won.player.evs).toEqual({ ...ZERO_SPREAD, hp: 1 });
  });

  it('gives benched members half XP and EVs only with Exp. Share on', () => {
    const lead = pokemon('treecko', 30, 'Pound');
    const bench = pokemon('torchic', 30, 'Scratch');
    const off = executeBattleTurn(startWildBattle([lead, bench], fragileWurmple()), 0, always(0.5));
    expect(off.playerParty[1]?.totalExp).toBe(bench.totalExp);
    const on = executeBattleTurn(startWildBattle([lead, bench], fragileWurmple(), { expShare: true }), 0, always(0.5));
    const half = expYield(getSpeciesById('wurmple'), 2, { isTrainerBattle: false, participated: false, holdsLuckyEgg: false });
    expect(on.playerParty[1]?.totalExp).toBe(bench.totalExp + half);
    expect(on.playerParty[1]?.evs.hp).toBe(1);
  });

  it('multiplies XP by 1.5 for a Lucky Egg holder', () => {
    const lead = { ...pokemon('treecko', 30, 'Pound'), heldItem: 'Lucky Egg' };
    const won = executeBattleTurn(startWildBattle(lead, fragileWurmple()), 0, always(0.5));
    const boosted = expYield(getSpeciesById('wurmple'), 2, { isTrainerBattle: false, participated: true, holdsLuckyEgg: true });
    expect(won.player.totalExp).toBe(lead.totalExp + boosted);
  });
});

describe('evolution (a/1/9/2)', () => {
  it('evolves Treecko into Grovyle at 16, keeping damage and learning the evolution-level move', () => {
    const treecko = { ...pokemon('treecko', 16, 'Pound', 'Leer', 'Absorb'), currentHp: 5 };
    const result = checkLevelUpEvolution(treecko, DAY);
    expect(result.evolved).toBe(true);
    expect(result.pokemon.species.name).toBe('Grovyle');
    expect(result.pokemon.currentHp).toBe(5 + (result.pokemon.maxHp - treecko.maxHp));
    expect(result.messages[0]).toBe('Treecko evoluiu para Grovyle!');
    expect(checkLevelUpEvolution(pokemon('treecko', 15, 'Pound'), DAY).evolved).toBe(false);
  });

  it('branches Wurmple by personality value', () => {
    const silcoon = { ...pokemon('wurmple', 7, 'Tackle'), personality: 3 << 16 };
    const cascoon = { ...pokemon('wurmple', 7, 'Tackle'), personality: 7 << 16 };
    expect(checkLevelUpEvolution(silcoon, DAY).pokemon.species.name).toBe('Silcoon');
    expect(checkLevelUpEvolution(cascoon, DAY).pokemon.species.name).toBe('Cascoon');
  });

  it('uses friendship and time of day for Eevee and items for stones', () => {
    const eevee = { ...pokemon('eevee', 20, 'Tackle'), friendship: 220 };
    expect(checkLevelUpEvolution(eevee, DAY).pokemon.species.name).toBe('Espeon');
    expect(checkLevelUpEvolution(eevee, NIGHT).pokemon.species.name).toBe('Umbreon');
    expect(checkLevelUpEvolution({ ...eevee, friendship: 70 }, DAY).evolved).toBe(false);
    expect(useEvolutionItem(eevee, 'Water Stone').pokemon.species.name).toBe('Vaporeon');
    expect(useEvolutionItem(eevee, 'Moon Stone')).toMatchObject({ evolved: false, messages: ['Não teria nenhum efeito.'] });
  });

  it('does not evolve trade-only species without a trade system', () => {
    const kadabra = pokemon('kadabra', 50, 'Confusion');
    expect(getEvolutionRules(kadabra.species).map((rule) => rule.method)).toEqual(['trade']);
    expect(checkLevelUpEvolution(kadabra, DAY).evolved).toBe(false);
  });

  it('evolves only members that leveled up in battle', () => {
    const party = [pokemon('treecko', 16, 'Pound'), pokemon('torchic', 16, 'Scratch')];
    const { party: next, messages } = evolveAfterBattle(party, [0], 'day');
    expect(next.map((member) => member.species.name)).toEqual(['Grovyle', 'Torchic']);
    expect(messages).toContain('Treecko evoluiu para Grovyle!');
  });

  it('records battle level-ups for post-battle evolution', () => {
    const almost = { ...pokemon('treecko', 15, 'Pound'), totalExp: totalExpForLevel('medium_slow', 16) - 1 };
    const won = executeBattleTurn(startWildBattle(almost, { ...pokemon('wurmple', 2, 'String Shot'), currentHp: 1 }), 0, always(0.5));
    expect(won.leveledUp).toEqual([0]);
    expect(evolveAfterBattle(won.playerParty, won.leveledUp, 'day').party[0]?.species.name).toBe('Grovyle');
  });

  it('maps 3DS clock hours to Gen VI time bands', () => {
    expect([4, 9, 10, 19, 20, 3].map(timeOfDayFromHour)).toEqual(['morning', 'morning', 'day', 'day', 'night', 'night']);
  });
});

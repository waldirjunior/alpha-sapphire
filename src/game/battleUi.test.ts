import { describe, expect, it } from 'vitest';
import { createPokemonInstance, startWildBattle } from '../core/battle';
import { SPECIES } from '../data/pokemon/species';
import { createHpBarMarkup, syncPartyFromBattle } from './battleUi';

describe('battle HP bar markup', () => {
  it('clamps HP ratio and rounds to a percentage', () => {
    expect(createHpBarMarkup(25, 40)).toContain('width:63%');
    expect(createHpBarMarkup(50, 40)).toContain('width:100%');
    expect(createHpBarMarkup(-1, 40)).toContain('width:0%');
  });

  it('uses the same green, yellow and red thresholds as the battle UI', () => {
    expect(createHpBarMarkup(30, 40)).toContain('background:#22c55e');
    expect(createHpBarMarkup(12, 40)).toContain('background:#eab308');
    expect(createHpBarMarkup(8, 40)).toContain('background:#ef4444');
    expect(createHpBarMarkup(0, 0)).toContain('width:0%');
  });

  it('syncs the battle party, active slot, and level-up jingle', () => {
    const oldPokemon = createPokemonInstance(SPECIES.torchic, 5);
    const leveledPokemon = createPokemonInstance(SPECIES.torchic, 6);
    const enemy = createPokemonInstance(SPECIES.poochyena, 3);
    const battle = startWildBattle([leveledPokemon], enemy);
    let party = [oldPokemon];
    let activeIndex = -1;
    const jingles: string[] = [];

    syncPartyFromBattle({
      getBattle: () => battle,
      getParty: () => party,
      setParty: (next) => { party = next; },
      setActivePartyIndex: (index) => { activeIndex = index; },
      playJingle: (name) => { jingles.push(name); },
    });

    expect(party[0]?.level).toBe(6);
    expect(activeIndex).toBe(0);
    expect(jingles).toEqual(['me_xy_lvup']);
  });
});

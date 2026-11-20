import { describe, expect, it } from 'vitest';
import { createPokemonInstance, startTrainerBattle, startWildBattle } from '../core/battle';
import { SPECIES } from '../data/pokemon/species';
import { countCaughtSpecies, createBattleCombatantMarkup, createHpBarMarkup, resolveBattleMusicContext, syncPartyFromBattle } from './battleUi';

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

  it('builds a compact, escaped combatant card for the battle touch panel', () => {
    const pokemon = createPokemonInstance(SPECIES.torchic, 5);
    const markup = createBattleCombatantMarkup('Rival <May>', pokemon);

    expect(markup).toContain('class="battle-combatant-heading"');
    expect(markup).toContain('Rival &lt;May&gt;');
    expect(markup).toContain('Torchic');
    expect(markup).toContain('Lv.5');
    expect(markup).toContain(`${pokemon.currentHp}/${pokemon.maxHp} HP`);
    expect(markup).toContain('hp-bar-track');
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

  it('counts unique Pokédex species in the party', () => {
    const repeated = createPokemonInstance(SPECIES.torchic, 5);
    const party = [repeated, { ...repeated, level: 6 }, createPokemonInstance(SPECIES.mudkip, 5)];

    expect(countCaughtSpecies(party)).toBe(2);
    expect(countCaughtSpecies([])).toBe(0);
  });

  it('resolves trainer music context automatically when a trainer battle starts', () => {
    const battle = startTrainerBattle(
      createPokemonInstance(SPECIES.torchic, 5),
      createPokemonInstance(SPECIES.poochyena, 3),
      'Team Aqua Grunt'
    );

    expect(resolveBattleMusicContext(battle)).toBe('aqua_magma');
  });
});

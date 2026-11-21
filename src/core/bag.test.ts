import { describe, expect, it } from 'vitest';
import {
  addBagItem,
  addEvolutionItem,
  consumePokeball,
  createInitialBag,
  useBagEvolutionItem,
  usePotion,
} from './bag';
import { createPokemonInstance, type PokemonInstance } from './battle';
import { SPECIES } from '../data/pokemon/species';
import { getSpeciesById } from './dex';

function makePokemon(currentHp: number, maxHp: number): PokemonInstance {
  return {
    ...createPokemonInstance(SPECIES.torchic, 5),
    currentHp,
    maxHp,
  };
}

describe('bag', () => {
  it('cria mochila inicial com 5 Poké Balls e 2 Potions', () => {
    const bag = createInitialBag();
    expect(bag).toEqual({ pokeballs: 5, potions: 2, keyItems: [], evolutionItems: {} });
  });

  it('consome Poké Balls de forma imutável e bloqueia quando zera', () => {
    const bag = { pokeballs: 1, potions: 0, keyItems: [] };
    const first = consumePokeball(bag);
    expect(first.ok).toBe(true);
    expect(first.bag.pokeballs).toBe(0);
    expect(bag.pokeballs).toBe(1);

    const second = consumePokeball(first.bag);
    expect(second.ok).toBe(false);
    expect(second.bag.pokeballs).toBe(0);
  });

  it('usa Potion curando até 20 HP sem exceder maxHp', () => {
    const bag = createInitialBag();
    const injured = makePokemon(8, 22);
    const result = usePotion(bag, injured);

    expect(result.used).toBe(true);
    expect(result.pokemon.currentHp).toBe(22);
    expect(result.bag.potions).toBe(1);
    expect(injured.currentHp).toBe(8);
  });

  it('não consome Potion se HP já está cheio', () => {
    const bag = createInitialBag();
    const healthy = makePokemon(22, 22);
    const result = usePotion(bag, healthy);

    expect(result.used).toBe(false);
    expect(result.bag.potions).toBe(2);
  });

  it('adiciona itens à mochila sem mutar o original', () => {
    const bag = createInitialBag();
    const updated = addBagItem(bag, 'pokeballs', 3);
    expect(updated.pokeballs).toBe(8);
    expect(bag.pokeballs).toBe(5);
  });

  it('acumula itens evolutivos sem mutar o inventário anterior', () => {
    const bag = createInitialBag();
    const updated = addEvolutionItem(addEvolutionItem(bag, 'Thunder Stone', 2), 'Thunder Stone', 1);

    expect(updated.evolutionItems).toEqual({ 'Thunder Stone': 3 });
    expect(bag.evolutionItems).toEqual({});
  });

  it('consome uma pedra compatível e retorna evolução e golpes pendentes', () => {
    const pikachu = createPokemonInstance(getSpeciesById('pikachu'), 20);
    const bag = addEvolutionItem(createInitialBag(), 'Thunder Stone', 1);
    const result = useBagEvolutionItem(bag, pikachu, 'Thunder Stone');

    expect(result.used).toBe(true);
    expect(result.evolved).toBe(true);
    expect(result.pokemon.species.id).toBe('raichu');
    expect(result.bag.evolutionItems).toEqual({});
    expect(bag.evolutionItems).toEqual({ 'Thunder Stone': 1 });
  });

  it('preserves the item when the party Pokémon is incompatible', () => {
    const poochyena = createPokemonInstance(SPECIES.poochyena, 5);
    const bag = addEvolutionItem(createInitialBag(), 'Thunder Stone', 1);
    const result = useBagEvolutionItem(bag, poochyena, 'Thunder Stone');

    expect(result.used).toBe(false);
    expect(result.evolved).toBe(false);
    expect(result.pokemon).toBe(poochyena);
    expect(result.bag).toBe(bag);
  });
});

import { describe, expect, it } from 'vitest';
import { addBagItem, consumePokeball, createInitialBag, usePotion } from './bag';
import { createPokemonInstance, type PokemonInstance } from './battle';
import { SPECIES } from '../data/pokemon/species';

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
    expect(bag).toEqual({ pokeballs: 5, potions: 2, keyItems: [] });
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
});

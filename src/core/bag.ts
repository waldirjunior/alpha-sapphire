import type { PokemonInstance } from './battle';

export interface BagState {
  pokeballs: number;
  potions: number;
  keyItems: string[];
}

export type ConsumableItemKind = 'pokeballs' | 'potions';

/** Retorna o inventário inicial do jogador em Hoenn. */
export function createInitialBag(): BagState {
  return {
    pokeballs: 5,
    potions: 2,
    keyItems: [],
  };
}

/** Adiciona quantidade positiva de um item consumível mantendo imutabilidade. */
export function addBagItem(
  bag: BagState,
  item: ConsumableItemKind,
  amount: number
): BagState {
  if (amount <= 0) return bag;
  return {
    ...bag,
    [item]: bag[item] + amount,
  };
}

/** Consome uma Poké Ball da mochila, indicando se havia estoque disponível. */
export function consumePokeball(bag: BagState): { bag: BagState; ok: boolean } {
  if (bag.pokeballs <= 0) {
    return { bag, ok: false };
  }
  return {
    bag: { ...bag, pokeballs: bag.pokeballs - 1 },
    ok: true,
  };
}

/** Aplica uma Potion (+20 HP até maxHp) caso haja estoque e dano a curar. */
export function usePotion(
  bag: BagState,
  pokemon: PokemonInstance
): { bag: BagState; pokemon: PokemonInstance; used: boolean } {
  if (bag.potions <= 0 || pokemon.currentHp >= pokemon.maxHp) {
    return { bag, pokemon, used: false };
  }

  const healedHp = Math.min(pokemon.maxHp, pokemon.currentHp + 20);
  return {
    bag: { ...bag, potions: bag.potions - 1 },
    pokemon: { ...pokemon, currentHp: healedHp },
    used: true,
  };
}

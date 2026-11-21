import type { PokemonInstance } from './battle';
import { findItemEvolution, useEvolutionItem, type EvolutionResult } from './evolution';

export interface BagState {
  pokeballs: number;
  potions: number;
  keyItems: string[];
  evolutionItems?: Record<string, number>;
}

export interface BagEvolutionItemResult extends EvolutionResult {
  bag: BagState;
  used: boolean;
}

export type ConsumableItemKind = 'pokeballs' | 'potions';

/** Retorna o inventário inicial do jogador em Hoenn. */
export function createInitialBag(): BagState {
  return {
    pokeballs: 5,
    potions: 2,
    keyItems: [],
    evolutionItems: {},
  };
}

/** Adiciona itens evolutivos por nome, acumulando o estoque sem mutar a mochila. */
export function addEvolutionItem(bag: BagState, itemName: string, amount: number): BagState {
  if (amount <= 0) return bag;
  const evolutionItems = bag.evolutionItems ?? {};
  return {
    ...bag,
    evolutionItems: { ...evolutionItems, [itemName]: (evolutionItems[itemName] ?? 0) + amount },
  };
}

/** Só consome o item se existir estoque e a espécie tiver evolução compatível. */
export function useBagEvolutionItem(
  bag: BagState,
  pokemon: PokemonInstance,
  itemName: string
): BagEvolutionItemResult {
  const count = bag.evolutionItems?.[itemName] ?? 0;
  const target = findItemEvolution(pokemon, itemName);
  if (count <= 0) return unchangedEvolutionItemUse(bag, pokemon, ['Você não tem esse item.']);
  if (!target) return { ...useEvolutionItem(pokemon, itemName), bag, used: false };

  const result = useEvolutionItem(pokemon, itemName);
  const evolutionItems = { ...(bag.evolutionItems ?? {}) };
  if (count === 1) delete evolutionItems[itemName];
  else evolutionItems[itemName] = count - 1;
  return { ...result, bag: { ...bag, evolutionItems }, used: result.evolved };
}

function unchangedEvolutionItemUse(
  bag: BagState,
  pokemon: PokemonInstance,
  messages: string[]
): BagEvolutionItemResult {
  return { bag, pokemon, used: false, evolved: false, pendingMoves: [], messages };
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

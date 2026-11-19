import type { BattleMove, PokemonInstance } from './battlePokemon';

const CHOICE_ITEMS = new Set(['Choice Band', 'Choice Specs', 'Choice Scarf']);

export function choiceItemMultiplier(pokemon: PokemonInstance, category: BattleMove['category']): number {
  if (category === 'physical' && pokemon.heldItem === 'Choice Band') return 1.5;
  if (category === 'special' && pokemon.heldItem === 'Choice Specs') return 1.5;
  return 1;
}

export function choiceSpeedMultiplier(pokemon: PokemonInstance): number {
  return pokemon.heldItem === 'Choice Scarf' ? 1.5 : 1;
}

export function defenseItemMultiplier(pokemon: PokemonInstance): number {
  return pokemon.heldItem === 'Eviolite' && pokemon.species.evolutionStage < 3 ? 1.5 : 1;
}

export function lifeOrbMultiplier(pokemon: PokemonInstance): number {
  return pokemon.heldItem === 'Life Orb' ? 1.3 : 1;
}

export function isChoiceItem(item: string | null): boolean {
  return item !== null && CHOICE_ITEMS.has(item);
}

export function isChoiceMoveBlocked(pokemon: PokemonInstance, move: BattleMove): boolean {
  const locked = pokemon.volatile.choiceLockMoveId;
  return move.id !== 165 && isChoiceItem(pokemon.heldItem) && locked !== undefined && locked !== null && locked !== move.id;
}

export function lockChoiceMove(pokemon: PokemonInstance, move: BattleMove): PokemonInstance {
  const locked = pokemon.volatile.choiceLockMoveId;
  if (!isChoiceItem(pokemon.heldItem) || locked !== undefined && locked !== null) return pokemon;
  return { ...pokemon, volatile: { ...pokemon.volatile, choiceLockMoveId: move.id } };
}

export function triggerThresholdBerry(pokemon: PokemonInstance): { pokemon: PokemonInstance; message: string | null } {
  if (pokemon.currentHp === 0 || pokemon.currentHp * 2 > pokemon.maxHp) return { pokemon, message: null };
  const amount = pokemon.heldItem === 'Sitrus Berry' ? Math.max(1, Math.floor(pokemon.maxHp / 4))
    : pokemon.heldItem === 'Oran Berry' ? 10 : 0;
  if (amount === 0) return { pokemon, message: null };
  return restoreFromBerry(pokemon, amount);
}

export function applyEndTurnHeldItem(pokemon: PokemonInstance): { pokemon: PokemonInstance; message: string | null } {
  if (pokemon.currentHp === 0) return { pokemon, message: null };
  if (pokemon.heldItem === 'Leftovers') {
    const amount = Math.max(1, Math.floor(pokemon.maxHp / 16));
    const restored = Math.min(amount, pokemon.maxHp - pokemon.currentHp);
    if (restored === 0) return { pokemon, message: null };
    return { pokemon: { ...pokemon, currentHp: pokemon.currentHp + restored }, message: `${pokemon.species.name} recuperou ${restored} HP com Leftovers.` };
  }
  return triggerThresholdBerry(pokemon);
}

function restoreFromBerry(pokemon: PokemonInstance, amount: number): { pokemon: PokemonInstance; message: string } {
  const restored = Math.min(amount, pokemon.maxHp - pokemon.currentHp);
  const item = pokemon.heldItem;
  return {
    pokemon: { ...pokemon, currentHp: pokemon.currentHp + restored, heldItem: null },
    message: `${pokemon.species.name} comeu ${item} e recuperou ${restored} HP.`,
  };
}

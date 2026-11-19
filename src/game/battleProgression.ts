import type { BattleState, PokemonInstance, TimeOfDay } from '../core/battle';
import { getMoveById } from '../core/dex';
import { checkLevelUpEvolution } from '../core/evolution';

export interface PendingMovePrompt {
  pokemonName: string;
  moveName: string;
  choices: { slot: number; moveName: string }[];
  skipLabel: string;
}

export function getPendingMovePrompt(battle: BattleState): PendingMovePrompt | null {
  const pending = battle.pendingMoves[0];
  if (!pending) return null;
  const pokemon = battle.playerParty[pending.partyIndex];
  if (!pokemon) return null;
  return {
    pokemonName: pokemon.species.name,
    moveName: getMoveById(pending.moveId).name,
    choices: pokemon.moves.map((move, slot) => ({ slot, moveName: move.name })),
    skipLabel: 'Desistir de aprender',
  };
}

export async function evolveAfterBattleWithPrompt(
  party: readonly PokemonInstance[],
  leveledUp: readonly number[],
  timeOfDay: TimeOfDay,
  confirm: (pokemon: PokemonInstance, evolved: PokemonInstance) => Promise<boolean>
): Promise<PokemonInstance[]> {
  const result = [...party];
  for (const index of leveledUp) {
    const pokemon = result[index];
    if (!pokemon || pokemon.currentHp === 0) continue;
    const evolution = checkLevelUpEvolution(pokemon, {
      timeOfDay,
      partyDexNumbers: result.map((member) => member.species.dexNumber),
    });
    if (!evolution.evolved || !(await confirm(pokemon, evolution.pokemon))) continue;
    result[index] = evolution.pokemon;
  }
  return result;
}

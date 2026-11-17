import { expProgress, refreshStats, toBattleMove, type PokemonInstance } from './battlePokemon';
import { getMoveById } from './dex';
import { levelForTotalExp, MAX_LEVEL, toGrowthRate, totalExpForLevel } from './experience';
import { getMovesLearnedAtLevel } from './learnsets';

export const MAX_KNOWN_MOVES = 4;

export interface ExperienceResult {
  pokemon: PokemonInstance;
  levelsGained: number[];
  learnedMoves: number[];
  /** Golpes do learnset que não couberam (4 golpes); a escolha é do jogador via `replaceMove`. */
  pendingMoves: number[];
  messages: string[];
}

export function gainExperience(pokemon: PokemonInstance, amount: number): ExperienceResult {
  const rate = toGrowthRate(pokemon.species.growthRate);
  const totalExp = Math.min(totalExpForLevel(rate, MAX_LEVEL), pokemon.totalExp + Math.max(0, amount));
  const newLevel = levelForTotalExp(rate, totalExp);
  const levelsGained = Array.from({ length: newLevel - pokemon.level }, (_, i) => pokemon.level + i + 1);
  const grown = levelsGained.length > 0 ? applyLevel(pokemon, newLevel) : pokemon;
  const leveled: PokemonInstance = { ...grown, totalExp, ...expProgress(pokemon.species, newLevel, totalExp) };
  const learning = learnLevelUpMoves(leveled, levelsGained);
  const name = pokemon.species.name;
  return {
    ...learning,
    levelsGained,
    messages: [...levelsGained.map((level) => `${name} subiu para o nível ${level}!`), ...learning.messages],
  };
}

function applyLevel(pokemon: PokemonInstance, level: number): PokemonInstance {
  return refreshStats({ ...pokemon, level });
}

export function learnLevelUpMoves(
  pokemon: PokemonInstance,
  levels: readonly number[]
): Pick<ExperienceResult, 'pokemon' | 'learnedMoves' | 'pendingMoves' | 'messages'> {
  let current = pokemon;
  const learnedMoves: number[] = [];
  const pendingMoves: number[] = [];
  const messages: string[] = [];
  for (const moveId of levels.flatMap((level) => getMovesLearnedAtLevel(pokemon.species, level))) {
    if (current.moves.some((move) => move.id === moveId)) continue;
    const move = getMoveById(moveId);
    if (current.moves.length >= MAX_KNOWN_MOVES) {
      pendingMoves.push(moveId);
      messages.push(`${pokemon.species.name} quer aprender ${move.name}, mas já conhece ${MAX_KNOWN_MOVES} golpes.`);
      continue;
    }
    current = { ...current, moves: [...current.moves, toBattleMove(move)] };
    learnedMoves.push(moveId);
    messages.push(`${pokemon.species.name} aprendeu ${move.name}!`);
  }
  return { pokemon: current, learnedMoves, pendingMoves, messages };
}

export function replaceMove(pokemon: PokemonInstance, slot: number, moveId: number): PokemonInstance {
  if (slot < 0 || slot >= pokemon.moves.length) {
    throw new RangeError(`Slot de golpe inválido para ${pokemon.species.name}: ${slot} (esperado 0..${pokemon.moves.length - 1}).`);
  }
  const moves = pokemon.moves.map((move, idx) => (idx === slot ? toBattleMove(getMoveById(moveId)) : move));
  return { ...pokemon, moves };
}

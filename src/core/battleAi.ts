import type { BattleMove, PokemonInstance } from './battlePokemon';
import { moveEffectiveness } from './damage';
import { ALWAYS_HITS_ACCURACY } from './moveExecution';
import { statusKindForMove, type Rng } from './statusConditions';

const STAB = 1.5;
const STATUS_INFLICT_SCORE = 40;
const STAT_CHANGE_SCORE = 15;
const HEAL_SCORE_WHEN_HURT = 60;
const HURT_RATIO = 0.5;

function pickIndex<T>(items: readonly T[], rng: Rng): T | undefined {
  return items[Math.floor(Math.min(0.999999, Math.max(0, rng())) * items.length)];
}

function usableMoveIndexes(pokemon: PokemonInstance): number[] {
  return pokemon.moves.flatMap((move, idx) => (move.currentPp > 0 ? [idx] : []));
}

/** Selvagem: golpe aleatório entre os que têm PP (Gen VI). */
export function selectWildMoveIndex(enemy: PokemonInstance, rng: Rng): number | null {
  return pickIndex(usableMoveIndexes(enemy), rng) ?? null;
}

function expectedDamageScore(user: PokemonInstance, target: PokemonInstance, move: BattleMove): number {
  const accuracy = move.accuracy === ALWAYS_HITS_ACCURACY ? 100 : move.accuracy;
  const stab = user.species.types.includes(move.type) ? STAB : 1;
  return move.power * moveEffectiveness(move, target) * stab * (accuracy / 100);
}

function statusMoveScore(user: PokemonInstance, target: PokemonInstance, move: BattleMove): number {
  if (move.healPercent > 0) return user.currentHp / user.maxHp < HURT_RATIO ? HEAL_SCORE_WHEN_HURT : 0;
  if (statusKindForMove(move)) return target.status ? 0 : STATUS_INFLICT_SCORE;
  return move.statChanges.length > 0 ? STAT_CHANGE_SCORE : 0;
}

export function scoreMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove): number {
  return move.category === 'status' ? statusMoveScore(user, target, move) : expectedDamageScore(user, target, move);
}

/** Treinador: maior pontuação (dano esperado ou utilidade de status); empates resolvidos pelo RNG injetado. */
export function selectTrainerMoveIndex(enemy: PokemonInstance, target: PokemonInstance, rng: Rng): number | null {
  const scores = enemy.moves.flatMap((move, idx) => (move.currentPp > 0 ? [{ idx, score: scoreMove(enemy, target, move) }] : []));
  if (scores.length === 0) return null;
  const best = Math.max(...scores.map((entry) => entry.score));
  const tied = scores.filter((entry) => entry.score === best).map((entry) => entry.idx);
  return pickIndex(tied, rng) ?? null;
}

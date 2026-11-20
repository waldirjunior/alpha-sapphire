import type { BattleMove, PokemonInstance } from './battlePokemon';
import { moveEffectiveness } from './damage';
import { ALWAYS_HITS_ACCURACY } from './moveExecution';
import { statusKindForMove, type Rng } from './statusConditions';
import { isChoiceItem } from './battleHeldItems';
import { attackingAbilityMultiplier, defendingAbilityMultiplier, movePowerAbilityMultiplier, stabMultiplier } from './battleAbilities';
import { lifeOrbMultiplier } from './battleHeldItems';

const STATUS_INFLICT_SCORE = 40;
const STAT_CHANGE_SCORE = 15;
const HEAL_SCORE_WHEN_HURT = 60;
const HURT_RATIO = 0.5;

function pickIndex<T>(items: readonly T[], rng: Rng): T | undefined {
  return items[Math.floor(Math.min(0.999999, Math.max(0, rng())) * items.length)];
}

function usableMoveIndexes(pokemon: PokemonInstance): number[] {
  const locked = pokemon.volatile.choiceLockMoveId;
  const encoreLocked = (pokemon.volatile.encoreTurns ?? 0) > 0 ? pokemon.volatile.encoreMoveId : null;
  return pokemon.moves.flatMap((move, idx) => {
    const allowed = !isChoiceItem(pokemon.heldItem) || locked === undefined || locked === null || locked === move.id;
    const disabled = (pokemon.volatile.disableTurns ?? 0) > 0 && pokemon.volatile.disableMoveId === move.id;
    const encored = encoreLocked === null || encoreLocked === undefined || encoreLocked === move.id;
    return move.currentPp > 0 && allowed && !disabled && encored ? [idx] : [];
  });
}

/** Selvagem: golpe aleatório entre os que têm PP (Gen VI). */
export function selectWildMoveIndex(enemy: PokemonInstance, rng: Rng): number | null {
  return pickIndex(usableMoveIndexes(enemy), rng) ?? null;
}

function expectedDamageScore(user: PokemonInstance, target: PokemonInstance, move: BattleMove): number {
  const accuracy = move.accuracy === ALWAYS_HITS_ACCURACY ? 100 : move.accuracy;
  const power = move.power * movePowerAbilityMultiplier(user, move);
  const damageAbility = attackingAbilityMultiplier(user, move) * lifeOrbMultiplier(user);
  return power * moveEffectiveness(move, target) * stabMultiplier(user, move) * damageAbility
    * (accuracy / 100) / defendingAbilityMultiplier(target);
}

function statusMoveScore(user: PokemonInstance, target: PokemonInstance, move: BattleMove): number {
  if (move.healPercent > 0) return user.currentHp / user.maxHp < HURT_RATIO ? HEAL_SCORE_WHEN_HURT : 0;
  if (statusKindForMove(move)) return target.status ? 0 : STATUS_INFLICT_SCORE;
  return move.statChanges.length > 0 ? STAT_CHANGE_SCORE : 0;
}

export function scoreMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove): number {
  return move.category === 'status' ? statusMoveScore(user, target, move) : expectedDamageScore(user, target, move);
}

export type TrainerActionChoice = { kind: 'move'; moveIndex: number | null } | { kind: 'switch'; partyIndex: number };

function bestDamageScore(user: PokemonInstance, target: PokemonInstance): number {
  const usable = new Set(usableMoveIndexes(user));
  return Math.max(0, ...user.moves.flatMap((move, index) =>
    usable.has(index) && move.category !== 'status' ? [expectedDamageScore(user, target, move)] : []));
}

/** Troca só quando a melhor resposta do ativo é fraca e um reserva tem vantagem clara. */
export function chooseTrainerAction(
  party: readonly PokemonInstance[],
  activeIndex: number,
  target: PokemonInstance,
  rng: Rng
): TrainerActionChoice {
  const active = party[activeIndex];
  if (!active) return { kind: 'move', moveIndex: null };
  const moveIndex = selectTrainerMoveIndex(active, target, rng);
  const outgoing = bestDamageScore(active, target);
  const incoming = bestDamageScore(target, active);
  if (incoming === 0 || outgoing > incoming * 0.5) return { kind: 'move', moveIndex };
  const candidates = party.flatMap((pokemon, index) => {
    if (index === activeIndex || pokemon.currentHp === 0) return [];
    const score = bestDamageScore(pokemon, target);
    return score >= incoming * 0.75 && score > outgoing * 1.5 ? [{ index, score }] : [];
  });
  if (candidates.length === 0) return { kind: 'move', moveIndex };
  const best = Math.max(...candidates.map((candidate) => candidate.score));
  const tied = candidates.filter((candidate) => candidate.score === best).map((candidate) => candidate.index);
  const chosen = pickIndex(tied, rng);
  return chosen === undefined ? { kind: 'move', moveIndex } : { kind: 'switch', partyIndex: chosen };
}

/** Treinador: maior pontuação (dano esperado ou utilidade de status); empates resolvidos pelo RNG injetado. */
export function selectTrainerMoveIndex(enemy: PokemonInstance, target: PokemonInstance, rng: Rng): number | null {
  const usable = new Set(usableMoveIndexes(enemy));
  const scores = enemy.moves.flatMap((move, idx) => (usable.has(idx) ? [{ idx, score: scoreMove(enemy, target, move) }] : []));
  if (scores.length === 0) return null;
  const best = Math.max(...scores.map((entry) => entry.score));
  const tied = scores.filter((entry) => entry.score === best).map((entry) => entry.idx);
  return pickIndex(tied, rng) ?? null;
}

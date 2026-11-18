import { selectTrainerMoveIndex, selectWildMoveIndex } from './battleAi';
import {
  appendLog,
  opposite,
  pokemonOf,
  resolveFaints,
  withPokemon,
  type BattleSide,
  type BattleState,
} from './battleParty';
import { toBattleMove, type BattleMove, type PokemonInstance } from './battlePokemon';
import { STRUGGLE_MOVE_ID } from './damage';
import { getMoveById } from './dex';
import { healthEvents } from './battleEvents';
import { executeMove, spendPp } from './moveExecution';
import { statStageMultiplier } from './statStages';
import { applyResidualDamage, checkCanAct, type Rng } from './statusConditions';

export type { BattleSide, BattleState, BattleStatus, PendingMoveLearn } from './battleParty';

/** `moveIndex === null` = Struggle (todos os golpes sem PP). */
export interface BattleAction {
  side: BattleSide;
  moveIndex: number | null;
}

const struggle = (): BattleMove => toBattleMove(getMoveById(STRUGGLE_MOVE_ID));
const PARALYSIS_SPEED_MULTIPLIER = 0.25;

export function hasUsableMove(pokemon: PokemonInstance): boolean {
  return pokemon.moves.some((move) => move.currentPp > 0);
}

export function selectEnemyMoveIndex(state: BattleState, rng: Rng): number | null {
  return state.isTrainer ? selectTrainerMoveIndex(state.enemy, state.player, rng) : selectWildMoveIndex(state.enemy, rng);
}

function moveFor(pokemon: PokemonInstance, moveIndex: number | null): BattleMove {
  return (moveIndex === null ? undefined : pokemon.moves[moveIndex]) ?? struggle();
}

export function effectiveSpeed(pokemon: PokemonInstance): number {
  const staged = Math.floor(pokemon.speed * statStageMultiplier(pokemon.stages.spe));
  return pokemon.status?.kind === 'paralysis' ? Math.floor(staged * PARALYSIS_SPEED_MULTIPLIER) : staged;
}

/** Prioridade (−7..+5) decide primeiro; depois velocidade efetiva; empate sorteado. */
export function orderActions(state: BattleState, a: BattleAction, b: BattleAction, rng: Rng): [BattleAction, BattleAction] {
  const priorityA = moveFor(pokemonOf(state, a.side), a.moveIndex).priority;
  const priorityB = moveFor(pokemonOf(state, b.side), b.moveIndex).priority;
  if (priorityA !== priorityB) return priorityA > priorityB ? [a, b] : [b, a];
  const speedA = effectiveSpeed(pokemonOf(state, a.side));
  const speedB = effectiveSpeed(pokemonOf(state, b.side));
  if (speedA !== speedB) return speedA > speedB ? [a, b] : [b, a];
  return rng() < 0.5 ? [a, b] : [b, a];
}

function performAction(state: BattleState, action: BattleAction, flinched: boolean, rng: Rng): { state: BattleState; flinchedSide: BattleSide | null } {
  const actor = pokemonOf(state, action.side);
  const foeSide = opposite(action.side);
  if (actor.currentHp === 0 || pokemonOf(state, foeSide).currentHp === 0) return { state, flinchedSide: null };
  if (flinched) return { state: appendLog(state, [`${actor.species.name} recuou e não pôde agir!`]), flinchedSide: null };
  const check = checkCanAct(actor, rng);
  let next = appendLog(withPokemon(state, action.side, check.pokemon), [check.message]);
  if (!check.canAct) return { state: { ...next, events: [...(next.events ?? []),
    ...healthEvents(action.side, actor.currentHp, check.pokemon.currentHp)] }, flinchedSide: null };

  const move = moveFor(check.pokemon, action.moveIndex);
  const user = action.moveIndex === null ? check.pokemon : spendPp(check.pokemon, action.moveIndex, pokemonOf(next, foeSide));
  const struggleNote = action.moveIndex === null ? `${user.species.name} não tem mais PP!` : null;
  const outcome = executeMove(user, pokemonOf(next, foeSide), move, rng);
  next = withPokemon(withPokemon(next, action.side, outcome.user), foeSide, outcome.target);
  next = { ...next, events: [...(next.events ?? []),
    { type: 'move', side: action.side, category: move.category },
    ...healthEvents(foeSide, pokemonOf(state, foeSide).currentHp, outcome.target.currentHp),
    ...healthEvents(action.side, actor.currentHp, outcome.user.currentHp)] };
  return { state: appendLog(next, [struggleNote, ...outcome.messages]), flinchedSide: outcome.flinched ? foeSide : null };
}

function applyEndOfTurn(state: BattleState, order: readonly BattleSide[]): BattleState {
  return order.reduce((current, side) => {
    const residual = applyResidualDamage(pokemonOf(current, side));
    const next = appendLog(withPokemon(current, side, residual.pokemon), [residual.message]);
    return { ...next, events: [...(next.events ?? []),
      ...healthEvents(side, pokemonOf(current, side).currentHp, residual.pokemon.currentHp)] };
  }, state);
}

/** Resolve um turno; `playerAction === null` = jogador gastou o turno (troca ou Poké Ball). */
export function resolveTurn(state: BattleState, playerAction: BattleAction | null, rng: Rng): BattleState {
  const enemyAction: BattleAction = { side: 'enemy', moveIndex: selectEnemyMoveIndex(state, rng) };
  const actions = playerAction ? orderActions(state, playerAction, enemyAction, rng) : [enemyAction];
  let current: BattleState = { ...state, events: [] };
  let flinchedSide: BattleSide | null = null;
  for (const action of actions) {
    const result = performAction(current, action, flinchedSide === action.side, rng);
    current = result.state;
    flinchedSide = result.flinchedSide;
  }
  const residualOrder: BattleSide[] = playerAction ? actions.map((action) => action.side) : ['enemy', 'player'];
  const resolved = resolveFaints(applyEndOfTurn(current, residualOrder));
  return { ...resolved, turn: resolved.turn + 1 };
}

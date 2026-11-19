import { selectTrainerMoveIndex, selectWildMoveIndex } from './battleAi';
import {
  appendLog,
  opposite,
  pokemonOf,
  resolveFaints,
  switchEnemyIn,
  switchPlayerIn,
  withPokemon,
  type BattleSide,
  type BattleState,
} from './battleParty';
import { toBattleMove, type BattleMove, type PokemonInstance } from './battlePokemon';
import { STRUGGLE_MOVE_ID } from './damage';
import { getMoveById } from './dex';
import { healthEvents } from './battleEvents';
import { executeMove, spendPp, targetsFoe, type MoveExecutionContext, type MoveOutcome } from './moveExecution';
import { statStageMultiplier } from './statStages';
import { advanceVolatileTurn, applyResidualDamage, checkCanAct, rollInRange, type Rng } from './statusConditions';
import { advanceBattleField, clearEntryHazards, setEntryHazard } from './battleField';

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
  if (flinched) return { state: appendLog(resetProtectStreak(state, action.side), [`${actor.species.name} recuou e não pôde agir!`]), flinchedSide: null };
  const check = checkCanAct(actor, rng);
  let next = appendLog(withPokemon(state, action.side, check.pokemon), [check.message]);
  if (!check.canAct) return { state: { ...resetProtectStreak(next, action.side), events: [...(next.events ?? []),
    ...healthEvents(action.side, actor.currentHp, check.pokemon.currentHp)] }, flinchedSide: null };

  const move = moveFor(check.pokemon, action.moveIndex);
  const prepared = isProtectionMove(move) ? check.pokemon : clearProtectStreak(check.pokemon);
  const user = action.moveIndex === null ? prepared : spendPp(prepared, action.moveIndex, pokemonOf(next, foeSide));
  if (user.volatile.tauntTurns > 0 && move.category === 'status') {
    next = withPokemon(next, action.side, clearProtectStreak(user));
    return { state: appendLog(next, [`${user.species.name} não pode usar ${move.name} por causa de Taunt!`]), flinchedSide: null };
  }
  if (targetsProtectedPokemon(next, action.side, move)) {
    next = withPokemon(next, action.side, user);
    return { state: appendLog(next, [`${pokemonOf(next, foeSide).species.name} se protegeu!`]), flinchedSide: null };
  }
  const struggleNote = action.moveIndex === null ? `${user.species.name} não tem mais PP!` : null;
  const context = moveContext(next, action.side, foeSide);
  const outcome = executeMove(user, pokemonOf(next, foeSide), move, rng, context);
  next = withPokemon(withPokemon(next, action.side, outcome.user), foeSide, outcome.target);
  next = applyFieldUpdate(next, action.side, outcome);
  next = { ...next, events: [...(next.events ?? []),
    { type: 'move', side: action.side, category: move.category },
    ...healthEvents(foeSide, pokemonOf(state, foeSide).currentHp, outcome.target.currentHp),
    ...healthEvents(action.side, actor.currentHp, outcome.user.currentHp)] };
  next = appendLog(next, [struggleNote, ...outcome.messages]);
  if (outcome.forceSwitch && pokemonOf(next, foeSide).currentHp > 0) next = forceSwitch(next, foeSide, rng);
  return { state: next, flinchedSide: outcome.flinched ? foeSide : null };
}

function resetProtectStreak(state: BattleState, side: BattleSide): BattleState {
  const pokemon = pokemonOf(state, side);
  return withPokemon(state, side, clearProtectStreak(pokemon));
}

function clearProtectStreak(pokemon: PokemonInstance): PokemonInstance {
  return pokemon.volatile.protectStreak === 0 ? pokemon : { ...pokemon, volatile: { ...pokemon.volatile, protectStreak: 0 } };
}

function isProtectionMove(move: BattleMove): boolean {
  return move.name === 'Protect' || move.name === 'Detect';
}

function targetsProtectedPokemon(state: BattleState, side: BattleSide, move: BattleMove): boolean {
  return targetsFoe(move) && pokemonOf(state, opposite(side)).volatile.protecting;
}

function forceSwitch(state: BattleState, side: BattleSide, rng: Rng): BattleState {
  if (side === 'enemy' && !state.isTrainer) {
    return { ...state, status: 'fled', log: [...state.log, `${state.enemy.species.name} selvagem fugiu!`] };
  }
  const party = side === 'player' ? state.playerParty : state.enemyParty;
  const active = side === 'player' ? state.playerActive : state.enemyActive;
  const choices = party.flatMap((member, index) => index !== active && member.currentHp > 0 ? [index] : []);
  if (choices.length === 0) return appendLog(state, ['Mas não havia outro Pokémon para trocar!']);
  const index = choices[rollInRange(0, choices.length - 1, rng)] ?? choices[0] ?? active;
  return side === 'player' ? switchPlayerIn(state, index) : switchEnemyIn(state, index, true);
}

function moveContext(state: BattleState, userSide: BattleSide, targetSide: BattleSide): MoveExecutionContext {
  const weatherSuppressed = [state.player.ability, state.enemy.ability].some((ability) => ability === 'Air Lock' || ability === 'Cloud Nine');
  return {
    weather: state.field.weather,
    weatherSuppressed,
    userScreens: state.field.screens[userSide],
    targetScreens: state.field.screens[targetSide],
    targetHazards: state.field.hazards[targetSide],
  };
}

function applyFieldUpdate(state: BattleState, side: BattleSide, outcome: MoveOutcome): BattleState {
  const update = outcome.fieldUpdate;
  if (!update) return state;
  const weather = 'weather' in update ? update.weather ?? null : state.field.weather;
  let screens = update.screen ? { ...state.field.screens, [side]: { ...state.field.screens[side], [update.screen]: 5 } } : state.field.screens;
  let hazards = state.field.hazards;
  if (update.hazard) hazards = setEntryHazard({ ...state.field, hazards }, opposite(side), update.hazard).field.hazards;
  if (update.clearHazards) {
    const sides = update.clearHazards === 'both' ? ['player', 'enemy'] as const : [side];
    hazards = clearEntryHazards({ ...state.field, hazards }, sides).hazards;
  }
  if (update.clearScreens) screens = { player: { reflect: 0, lightScreen: 0 }, enemy: { reflect: 0, lightScreen: 0 } };
  return { ...state, field: { weather, screens, hazards } };
}

function applyEndOfTurn(state: BattleState, order: readonly BattleSide[]): BattleState {
  return order.reduce((current, side) => {
    const weatherSuppressed = [current.player.ability, current.enemy.ability].some((ability) => ability === 'Air Lock' || ability === 'Cloud Nine');
    const residual = applyResidualDamage(pokemonOf(current, side), current.field.weather?.kind ?? null, weatherSuppressed);
    const aged = advanceVolatileTurn(residual.pokemon);
    let next = appendLog(withPokemon(current, side, aged), [residual.message]);
    if (residual.leechSeedDrain > 0) next = healOpposingActive(next, side, residual.leechSeedDrain);
    return { ...next, events: [...(next.events ?? []),
      ...healthEvents(side, pokemonOf(current, side).currentHp, residual.pokemon.currentHp)] };
  }, state);
}

function healOpposingActive(state: BattleState, seededSide: BattleSide, amount: number): BattleState {
  const receiverSide = opposite(seededSide);
  const receiver = pokemonOf(state, receiverSide);
  if (receiver.currentHp === 0) return state;
  return withPokemon(state, receiverSide, { ...receiver, currentHp: Math.min(receiver.maxHp, receiver.currentHp + amount) });
}

function ageBattleField(state: BattleState): BattleState {
  const advanced = advanceBattleField(state.field);
  const next = { ...state, field: advanced.field };
  return appendLog(next, advanced.messages);
}

/** Resolve um turno; `playerAction === null` = jogador gastou o turno (troca ou Poké Ball). */
export function resolveTurn(state: BattleState, playerAction: BattleAction | null, rng: Rng): BattleState {
  const enemyAction: BattleAction = { side: 'enemy', moveIndex: selectEnemyMoveIndex(state, rng) };
  const actions = playerAction ? orderActions(state, playerAction, enemyAction, rng) : [enemyAction];
  let current: BattleState = { ...state, events: [] };
  let flinchedSide: BattleSide | null = null;
  for (const action of actions) {
    if (current.status !== 'ongoing') break;
    const result = performAction(current, action, flinchedSide === action.side, rng);
    current = result.state;
    flinchedSide = result.flinchedSide;
  }
  if (current.status !== 'ongoing') return { ...current, turn: current.turn + 1 };
  const residualOrder: BattleSide[] = playerAction ? actions.map((action) => action.side) : ['enemy', 'player'];
  const resolved = resolveFaints(ageBattleField(applyEndOfTurn(current, residualOrder)));
  return { ...resolved, turn: resolved.turn + 1 };
}

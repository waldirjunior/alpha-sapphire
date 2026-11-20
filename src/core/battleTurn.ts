import { chooseTrainerAction, selectTrainerMoveIndex, selectWildMoveIndex } from './battleAi';
import {
  appendLog,
  firstHealthyIndex,
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
import { executeMove, isChargeMove, spendPp, targetsFoe, type MoveExecutionContext, type MoveOutcome } from './moveExecution';
import { applyStageDelta, statStageMultiplier } from './statStages';
import { advanceVolatileTurn, applyResidualDamage, checkCanAct, rollInRange, type Rng } from './statusConditions';
import { advanceBattleField, clearEntryHazards, setEntryHazard } from './battleField';
import { applyEndTurnHeldItem, choiceSpeedMultiplier, isChoiceMoveBlocked, lockChoiceMove } from './battleHeldItems';

export type { BattleSide, BattleState, BattleStatus, PendingMoveLearn } from './battleParty';

/** `moveIndex === null` = Struggle (todos os golpes sem PP). */
export interface BattleAction {
  side: BattleSide;
  moveIndex: number | null;
  switchIndex?: number;
}

const struggle = (): BattleMove => toBattleMove(getMoveById(STRUGGLE_MOVE_ID));
const PARALYSIS_SPEED_MULTIPLIER = 0.25;

export function hasUsableMove(pokemon: PokemonInstance): boolean {
  return pokemon.moves.some((move) => move.currentPp > 0 && !isDisabled(pokemon, move));
}

export function selectEnemyMoveIndex(state: BattleState, rng: Rng): number | null {
  const chargeMoveId = state.enemy.volatile.chargeMoveId;
  if (chargeMoveId !== undefined && chargeMoveId !== null) {
    return state.enemy.moves.findIndex((move) => move.id === chargeMoveId);
  }
  const encoreMoveId = state.enemy.volatile.encoreMoveId;
  if ((state.enemy.volatile.encoreTurns ?? 0) > 0 && encoreMoveId !== undefined && encoreMoveId !== null) {
    const encoreIndex = state.enemy.moves.findIndex((move) => move.id === encoreMoveId && move.currentPp > 0);
    if (encoreIndex >= 0) return encoreIndex;
  }
  return state.isTrainer ? selectTrainerMoveIndex(state.enemy, state.player, rng) : selectWildMoveIndex(state.enemy, rng);
}

function selectEnemyAction(state: BattleState, rng: Rng): BattleAction {
  const chargeMoveId = state.enemy.volatile.chargeMoveId;
  if (chargeMoveId !== undefined && chargeMoveId !== null) return { side: 'enemy', moveIndex: selectEnemyMoveIndex(state, rng) };
  if (state.isTrainer) {
    const decision = chooseTrainerAction(state.enemyParty, state.enemyActive, state.player, rng);
    return decision.kind === 'switch'
      ? { side: 'enemy', moveIndex: null, switchIndex: decision.partyIndex }
      : { side: 'enemy', moveIndex: decision.moveIndex };
  }
  return { side: 'enemy', moveIndex: selectEnemyMoveIndex(state, rng) };
}

function moveFor(pokemon: PokemonInstance, moveIndex: number | null): BattleMove {
  const chargeMoveId = pokemon.volatile.chargeMoveId;
  if (chargeMoveId !== undefined && chargeMoveId !== null) {
    return pokemon.moves.find((move) => move.id === chargeMoveId) ?? toBattleMove(getMoveById(chargeMoveId));
  }
  const encoreMoveId = pokemon.volatile.encoreMoveId;
  if ((pokemon.volatile.encoreTurns ?? 0) > 0 && encoreMoveId !== undefined && encoreMoveId !== null) {
    const encoreMove = pokemon.moves.find((move) => move.id === encoreMoveId && move.currentPp > 0);
    if (encoreMove) return encoreMove;
  }
  return (moveIndex === null ? undefined : pokemon.moves[moveIndex]) ?? struggle();
}

export function effectiveSpeed(pokemon: PokemonInstance): number {
  const staged = Math.floor(pokemon.speed * statStageMultiplier(pokemon.stages.spe));
  const held = Math.floor(staged * choiceSpeedMultiplier(pokemon));
  return pokemon.status?.kind === 'paralysis' ? Math.floor(held * PARALYSIS_SPEED_MULTIPLIER) : held;
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

function performAction(state: BattleState, action: BattleAction, targetAction: BattleAction | null, flinched: boolean, rng: Rng): { state: BattleState; flinchedSide: BattleSide | null } {
  const actor = pokemonOf(state, action.side);
  const foeSide = opposite(action.side);
  if (actor.currentHp === 0 || pokemonOf(state, foeSide).currentHp === 0) return { state, flinchedSide: null };
  if (flinched) return { state: appendLog(resetProtectStreak(state, action.side), [`${actor.species.name} recuou e não pôde agir!`]), flinchedSide: null };
  const check = checkCanAct(actor, rng);
  let next = appendLog(withPokemon(state, action.side, check.pokemon), [check.message]);
  if (!check.canAct) return { state: { ...resetProtectStreak(next, action.side), events: [...(next.events ?? []),
    ...healthEvents(action.side, actor.currentHp, check.pokemon.currentHp)] }, flinchedSide: null };

  const charging = check.pokemon.volatile.chargeMoveId !== undefined && check.pokemon.volatile.chargeMoveId !== null;
  const move = moveFor(check.pokemon, action.moveIndex);
  if (isDisabled(check.pokemon, move)) {
    const disabled = withPokemon(next, action.side, clearProtectStreak(check.pokemon));
    return { state: appendLog(disabled, [`${check.pokemon.species.name} não pode usar ${move.name}!`]), flinchedSide: null };
  }
  const encoreLocked = (check.pokemon.volatile.encoreTurns ?? 0) > 0 && check.pokemon.volatile.encoreMoveId === move.id;
  const moveIndex = charging || encoreLocked ? check.pokemon.moves.findIndex((slot) => slot.id === move.id) : action.moveIndex;
  if (isChoiceMoveBlocked(check.pokemon, move)) {
    const lockedName = getMoveById(check.pokemon.volatile.choiceLockMoveId ?? move.id).name;
    return { state: appendLog(next, [`${check.pokemon.species.name} só pode usar ${lockedName} por causa do item Choice!`]), flinchedSide: null };
  }
  const prepared = isProtectionMove(move) ? check.pokemon : clearProtectStreak(check.pokemon);
  const spent = charging || moveIndex === null ? prepared : spendPp(prepared, moveIndex, pokemonOf(next, foeSide));
  const user = !charging && moveIndex !== null ? lockChoiceMove(spent, move) : spent;
  if (user.volatile.tauntTurns > 0 && move.category === 'status') {
    next = withPokemon(next, action.side, clearProtectStreak(user));
    return { state: appendLog(next, [`${user.species.name} não pode usar ${move.name} por causa de Taunt!`]), flinchedSide: null };
  }
  const beginsCharge = !charging && isChargeMove(move);
  if (targetsProtectedPokemon(next, action.side, move) && !beginsCharge) {
    const protectedUser = charging
      ? { ...user, volatile: { ...user.volatile, chargeMoveId: null } }
      : { ...user, lastMoveId: move.id };
    next = withPokemon(next, action.side, protectedUser);
    return { state: appendLog(next, [`${pokemonOf(next, foeSide).species.name} se protegeu!`]), flinchedSide: null };
  }
  const struggleNote = action.moveIndex === null && !charging ? `${user.species.name} não tem mais PP!` : null;
  const context = moveContext(next, action.side, foeSide, targetAction);
  const outcome = executeMove({ ...user, lastMoveId: move.id }, pokemonOf(next, foeSide), move, rng, context);
  next = withPokemon(withPokemon(next, action.side, outcome.user), foeSide, outcome.target);
  next = applyFieldUpdate(next, action.side, outcome);
  next = { ...next, events: [...(next.events ?? []),
    { type: 'move', side: action.side, category: move.category },
    ...healthEvents(foeSide, pokemonOf(state, foeSide).currentHp, outcome.target.currentHp),
    ...healthEvents(action.side, actor.currentHp, outcome.user.currentHp)] };
  next = appendLog(next, [struggleNote, ...outcome.messages]);
  if (outcome.forceSwitch && pokemonOf(next, foeSide).currentHp > 0) next = forceSwitch(next, foeSide, rng);
  if (outcome.switchUser && pokemonOf(next, action.side).currentHp > 0) next = switchToNextHealthy(next, action.side);
  return { state: next, flinchedSide: outcome.flinched ? foeSide : null };
}

function isDisabled(pokemon: PokemonInstance, move: BattleMove): boolean {
  return (pokemon.volatile.disableTurns ?? 0) > 0 && pokemon.volatile.disableMoveId === move.id;
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

function moveContext(state: BattleState, userSide: BattleSide, targetSide: BattleSide, targetAction: BattleAction | null): MoveExecutionContext {
  const weatherSuppressed = [state.player.ability, state.enemy.ability].some((ability) => ability === 'Air Lock' || ability === 'Cloud Nine');
  return {
    weather: state.field.weather,
    weatherSuppressed,
    userScreens: state.field.screens[userSide],
    targetScreens: state.field.screens[targetSide],
    targetHazards: state.field.hazards[targetSide],
    targetMoveCategory: targetAction ? moveFor(pokemonOf(state, targetSide), targetAction.moveIndex).category : null,
  };
}

function switchToNextHealthy(state: BattleState, side: BattleSide): BattleState {
  const party = side === 'player' ? state.playerParty : state.enemyParty;
  const active = side === 'player' ? state.playerActive : state.enemyActive;
  const next = firstHealthyIndex(party, active);
  if (next < 0) return state;
  return side === 'player' ? switchPlayerIn(state, next) : switchEnemyIn(state, next);
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

function applyEndOfTurn(state: BattleState, order: readonly BattleSide[], rng: Rng): BattleState {
  return order.reduce((current, side) => {
    const weatherSuppressed = [current.player.ability, current.enemy.ability].some((ability) => ability === 'Air Lock' || ability === 'Cloud Nine');
    const residual = applyResidualDamage(pokemonOf(current, side), current.field.weather?.kind ?? null, weatherSuppressed);
    const aged = advanceVolatileTurn(residual.pokemon, rng);
    const item = applyEndTurnHeldItem(aged.pokemon);
    const boosted = applySpeedBoost(item.pokemon);
    let next = appendLog(withPokemon(current, side, boosted), [residual.message, ...aged.messages, item.message]);
    if (residual.leechSeedDrain > 0) next = healOpposingActive(next, side, residual.leechSeedDrain);
    return { ...next, events: [...(next.events ?? []),
      ...healthEvents(side, pokemonOf(current, side).currentHp, boosted.currentHp)] };
  }, state);
}

function applySpeedBoost(pokemon: PokemonInstance): PokemonInstance {
  if (pokemon.ability !== 'Speed Boost' || pokemon.currentHp === 0) return pokemon;
  const result = applyStageDelta(pokemon.stages, 'spe', 1);
  return result.applied === 0 ? pokemon : { ...pokemon, stages: result.stages };
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
  const selectedEnemyAction = selectEnemyAction(state, rng);
  const enemySwitch = selectedEnemyAction.switchIndex;
  let current: BattleState = {
    ...(enemySwitch === undefined ? state : switchEnemyIn(state, enemySwitch)),
    events: [],
  };
  const enemyAction = enemySwitch === undefined ? selectedEnemyAction : null;
  const actions = playerAction && enemyAction ? orderActions(current, playerAction, enemyAction, rng)
    : playerAction ? [playerAction] : enemyAction ? [enemyAction] : [];
  let flinchedSide: BattleSide | null = null;
  for (const action of actions) {
    if (current.status !== 'ongoing') break;
    const targetAction = actions.find((candidate) => candidate.side !== action.side) ?? null;
    const result = performAction(current, action, targetAction, flinchedSide === action.side, rng);
    current = result.state;
    flinchedSide = result.flinchedSide;
  }
  if (current.status !== 'ongoing') return { ...current, turn: current.turn + 1 };
  const residualOrder = actions.map((action) => action.side);
  for (const side of ['player', 'enemy'] as const) {
    if (!residualOrder.includes(side)) residualOrder.push(side);
  }
  const resolved = resolveFaints(ageBattleField(applyEndOfTurn(current, residualOrder, rng)));
  return { ...resolved, turn: resolved.turn + 1 };
}

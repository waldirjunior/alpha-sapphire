import { awardXp, toBattleMove, type BattleMove, type PokemonInstance } from './battlePokemon';
import { STRUGGLE_MOVE_ID } from './damage';
import { getMoveById } from './dex';
import { executeMove, spendPp } from './moveExecution';
import { statStageMultiplier } from './statStages';
import { applyResidualDamage, checkCanAct, type Rng } from './statusConditions';

export type BattleStatus = 'ongoing' | 'victory' | 'defeat' | 'fled' | 'caught';

export interface BattleState {
  player: PokemonInstance;
  enemy: PokemonInstance;
  turn: number;
  status: BattleStatus;
  log: string[];
  isTrainer?: boolean;
  trainerName?: string;
}

export type BattleSide = 'player' | 'enemy';

/** `moveIndex === null` = Struggle (todos os golpes sem PP). */
export interface BattleAction {
  side: BattleSide;
  moveIndex: number | null;
}

const STRUGGLE: BattleMove = toBattleMove(getMoveById(STRUGGLE_MOVE_ID));
const PARALYSIS_SPEED_MULTIPLIER = 0.25;
const XP_PER_ENEMY_LEVEL = 24;

export function hasUsableMove(pokemon: PokemonInstance): boolean {
  return pokemon.moves.some((move) => move.currentPp > 0);
}

export function selectEnemyMoveIndex(enemy: PokemonInstance, rng: Rng): number | null {
  const usable = enemy.moves.flatMap((move, idx) => (move.currentPp > 0 ? [idx] : []));
  if (usable.length === 0) return null;
  const pick = Math.floor(Math.min(0.999999, Math.max(0, rng())) * usable.length);
  return usable[pick] ?? null;
}

function moveFor(pokemon: PokemonInstance, moveIndex: number | null): BattleMove {
  return moveIndex === null ? STRUGGLE : pokemon.moves[moveIndex] ?? STRUGGLE;
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

function pokemonOf(state: BattleState, side: BattleSide): PokemonInstance {
  return side === 'player' ? state.player : state.enemy;
}

function opposite(side: BattleSide): BattleSide {
  return side === 'player' ? 'enemy' : 'player';
}

function withPokemon(state: BattleState, side: BattleSide, pokemon: PokemonInstance): BattleState {
  return side === 'player' ? { ...state, player: pokemon } : { ...state, enemy: pokemon };
}

function appendLog(state: BattleState, messages: readonly (string | null)[]): BattleState {
  const lines = messages.filter((line): line is string => line !== null);
  return lines.length === 0 ? state : { ...state, log: [...state.log, ...lines] };
}

function performAction(state: BattleState, action: BattleAction, flinched: boolean, rng: Rng): { state: BattleState; flinchedSide: BattleSide | null } {
  const actor = pokemonOf(state, action.side);
  if (actor.currentHp === 0) return { state, flinchedSide: null };
  if (flinched) return { state: appendLog(state, [`${actor.species.name} recuou e não pôde agir!`]), flinchedSide: null };
  const check = checkCanAct(actor, rng);
  let next = appendLog(withPokemon(state, action.side, check.pokemon), [check.message]);
  if (!check.canAct) return { state: next, flinchedSide: null };

  const foeSide = opposite(action.side);
  const move = moveFor(check.pokemon, action.moveIndex);
  const user = action.moveIndex === null ? check.pokemon : spendPp(check.pokemon, action.moveIndex, pokemonOf(next, foeSide));
  const struggleNote = action.moveIndex === null ? `${user.species.name} não tem mais PP!` : null;
  const outcome = executeMove(user, pokemonOf(next, foeSide), move, rng);
  next = withPokemon(withPokemon(next, action.side, outcome.user), foeSide, outcome.target);
  return { state: appendLog(next, [struggleNote, ...outcome.messages]), flinchedSide: outcome.flinched ? foeSide : null };
}

function concludeIfFainted(state: BattleState): BattleState | null {
  if (state.enemy.currentHp === 0) return concludeVictory(state);
  if (state.player.currentHp === 0) {
    return { ...appendLog(state, [`${state.player.species.name} desmaiou!`]), status: 'defeat', turn: state.turn + 1 };
  }
  return null;
}

function concludeVictory(state: BattleState): BattleState {
  const xpGain = state.enemy.level * XP_PER_ENEMY_LEVEL;
  const { updated, leveledUp } = awardXp(state.player, xpGain);
  const levelNote = leveledUp ? `${updated.species.name} subiu para o nível ${updated.level}!` : null;
  const defeated = `${state.enemy.species.name} ${state.isTrainer ? 'do oponente' : 'selvagem'} foi derrotado! (+${xpGain} XP)`;
  return { ...appendLog({ ...state, player: updated }, [defeated, levelNote]), status: 'victory', turn: state.turn + 1 };
}

function applyEndOfTurn(state: BattleState, order: readonly BattleSide[]): BattleState {
  return order.reduce((current, side) => {
    const residual = applyResidualDamage(pokemonOf(current, side));
    return appendLog(withPokemon(current, side, residual.pokemon), [residual.message]);
  }, state);
}

/** Resolve um turno; `playerAction === null` = jogador gastou o turno (troca ou Poké Ball). */
export function resolveTurn(state: BattleState, playerAction: BattleAction | null, rng: Rng): BattleState {
  const enemyAction: BattleAction = { side: 'enemy', moveIndex: selectEnemyMoveIndex(state.enemy, rng) };
  const actions = playerAction ? orderActions(state, playerAction, enemyAction, rng) : [enemyAction];
  let current = state;
  let flinchedSide: BattleSide | null = null;
  for (const action of actions) {
    const result = performAction(current, action, flinchedSide === action.side, rng);
    current = result.state;
    flinchedSide = result.flinchedSide;
    const ended = concludeIfFainted(current);
    if (ended) return ended;
  }
  const residualOrder: BattleSide[] = playerAction ? actions.map((action) => action.side) : ['enemy', 'player'];
  const afterResidual = applyEndOfTurn(current, residualOrder);
  return concludeIfFainted(afterResidual) ?? { ...afterResidual, turn: afterResidual.turn + 1 };
}

import type { WildEncounterEntry } from '../data/pokemon/route101';
import { activateEntryAbility, firstHealthyIndex, switchPlayerIn, validateParty, withPokemon, type BattleState } from './battleParty';
import { restoreAtPokemonCenter, withdrawFromBattle, type PokemonInstance } from './battlePokemon';
import { hasUsableMove, resolveTurn } from './battleTurn';
import { replaceMove } from './levelUp';
import type { Rng } from './statusConditions';
import { createBattleField, type BattleWeather } from './battleField';
import { rollGenSixCapture } from './battleCapture';

export {
  createPokemonInstance,
  type BattleMove,
  type MajorStatus,
  type MajorStatusKind,
  type PokemonInstance,
} from './battlePokemon';
export type { BattleAction, BattleState, BattleStatus, PendingMoveLearn } from './battleTurn';
export { calculateDamage, getTypeEffectiveness } from './damage';
export { genSixCatchShakeThreshold } from './battleCapture';
export { gainExperience, replaceMove } from './levelUp';
export { evolveAfterBattle, timeOfDayFromHour, useEvolutionItem, type TimeOfDay } from './evolution';

const ENCOUNTER_RATE = 0.2;

type PartyInput = PokemonInstance | readonly PokemonInstance[];

export function rollWildEncounter(
  table: WildEncounterEntry[],
  triggerRng: Rng = Math.random,
  pickRng: Rng = Math.random
): { speciesId: string; level: number } | null {
  if (table.length === 0 || triggerRng() >= ENCOUNTER_RATE) {
    return null;
  }
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  let target = Math.min(0.999999, Math.max(0, pickRng())) * totalWeight;
  for (const entry of table) {
    if (target < entry.weight) {
      const span = entry.maxLevel - entry.minLevel + 1;
      const level = entry.minLevel + Math.floor(Math.min(0.999999, Math.max(0, pickRng())) * span);
      return { speciesId: entry.speciesId, level };
    }
    target -= entry.weight;
  }
  const fallback = table[table.length - 1];
  return fallback ? { speciesId: fallback.speciesId, level: fallback.minLevel } : null;
}

function isPartyList(input: PartyInput): input is readonly PokemonInstance[] {
  return Array.isArray(input);
}

function toParty(input: PartyInput, owner: string): PokemonInstance[] {
  const party = isPartyList(input) ? [...input] : [input];
  validateParty(party, owner);
  return party.map(withdrawFromBattle);
}

function leadIndex(party: readonly PokemonInstance[], owner: string): number {
  const index = firstHealthyIndex(party);
  if (index < 0) throw new Error(`Time de ${owner} não tem Pokémon de pé para iniciar a batalha.`);
  return index;
}

export interface BattleOptions {
  expShare?: boolean;
  weather?: BattleWeather;
}

function createBattle(
  playerInput: PartyInput,
  enemyInput: PartyInput,
  firstLine: (enemy: PokemonInstance) => string,
  options: BattleOptions & { trainerName?: string }
): BattleState {
  const { trainerName } = options;
  const playerParty = toParty(playerInput, 'jogador');
  const enemyParty = toParty(enemyInput, trainerName ?? 'selvagem');
  const playerActive = leadIndex(playerParty, 'jogador');
  const enemyActive = leadIndex(enemyParty, trainerName ?? 'selvagem');
  const player = playerParty[playerActive] ?? playerParty[0];
  const enemy = enemyParty[enemyActive] ?? enemyParty[0];
  if (!player || !enemy) throw new Error('Batalha sem combatentes.');
  const battle: BattleState = {
    player,
    enemy,
    playerParty,
    enemyParty,
    playerActive,
    enemyActive,
    participants: [playerActive],
    pendingSwitch: false,
    pendingMoves: [],
    field: createBattleField(options.weather),
    expShare: options.expShare ?? false,
    leveledUp: [],
    turn: 1,
    status: 'ongoing',
    log: [firstLine(enemy)],
    ...(trainerName ? { isTrainer: true, trainerName } : {}),
  };
  return activateEntryAbility(activateEntryAbility(battle, 'player'), 'enemy');
}

/** Aceita um Pokémon ou o time inteiro (até 6); o primeiro de pé entra em campo. */
export function startWildBattle(player: PartyInput, enemy: PokemonInstance, options: BattleOptions = {}): BattleState {
  return createBattle(player, enemy, (wild) => `Um ${wild.species.name} selvagem (Lv.${wild.level}) apareceu!`, options);
}

export function startTrainerBattle(player: PartyInput, enemy: PartyInput, trainerName: string, options: BattleOptions = {}): BattleState {
  const intro = (lead: PokemonInstance) => `${trainerName} desafiou você! Ele enviou ${lead.species.name} (Lv.${lead.level})!`;
  return createBattle(player, enemy, intro, { ...options, trainerName });
}

export function runFromBattle(state: BattleState): BattleState {
  if (state.status !== 'ongoing') return state;
  if (state.isTrainer) {
    return {
      ...state,
      log: [...state.log, 'Não é possível fugir de uma batalha contra treinador!'],
    };
  }
  return {
    ...state,
    status: 'fled',
    log: [...state.log, `${state.player.species.name} fugiu da batalha!`],
  };
}

/** Centro Pokémon: HP, PP, status e estágios restaurados. */
export function healParty(party: PokemonInstance[]): PokemonInstance[] {
  return party.map(restoreAtPokemonCenter);
}

/** Atualiza o Pokémon ativo do jogador mantendo `playerParty` sincronizado (ex.: Potion). */
export function updateActivePlayer(state: BattleState, pokemon: PokemonInstance): BattleState {
  return withPokemon(state, 'player', pokemon);
}

/** Troca forçada (após desmaio) não dá turno ao inimigo; troca voluntária sim. */
export function switchActivePokemon(state: BattleState, partyIndex: number, rng: Rng = Math.random): BattleState {
  if (state.status !== 'ongoing') return state;
  const switched = switchPlayerIn(state, partyIndex);
  if (state.pendingSwitch) return { ...switched, pendingSwitch: false };
  return resolveTurn(switched, null, rng);
}

export function throwPokeball(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.status !== 'ongoing' || state.pendingSwitch) return state;
  if (state.isTrainer) {
    return {
      ...state,
      log: [...state.log, 'Você não pode capturar o Pokémon de outro treinador!'],
    };
  }
  if (rollGenSixCapture(state.enemy, rng)) {
    return {
      ...state,
      status: 'caught',
      log: [...state.log, `Você capturou ${state.enemy.species.name}!`],
    };
  }
  const escaped = { ...state, log: [...state.log, `${state.enemy.species.name} escapou da Poké Ball!`] };
  return resolveTurn(escaped, null, rng);
}

/**
 * Golpe sem PP não pode ser escolhido (o turno não avança); sem nenhum PP o Pokémon usa Struggle.
 */
export function executeBattleTurn(state: BattleState, playerMoveIndex: number, rng: Rng = Math.random): BattleState {
  if (state.status !== 'ongoing') return state;
  if (state.pendingSwitch) {
    return { ...state, log: [...state.log, 'Escolha um Pokémon para entrar antes de atacar!'] };
  }
  if (!hasUsableMove(state.player)) {
    return resolveTurn(state, { side: 'player', moveIndex: null }, rng);
  }
  const move = state.player.moves[playerMoveIndex];
  if (!move) {
    throw new RangeError(`Golpe ${playerMoveIndex} inexistente para ${state.player.species.name} (tem ${state.player.moves.length}).`);
  }
  if (move.currentPp === 0) {
    return { ...state, log: [...state.log, `Não há PP restante para ${move.name}!`] };
  }
  return resolveTurn(state, { side: 'player', moveIndex: playerMoveIndex }, rng);
}

/** Resolve um golpe pendente de aprendizado: `slot` substituído, ou `null` para desistir. */
export function resolvePendingMove(state: BattleState, slot: number | null): BattleState {
  const [pending, ...rest] = state.pendingMoves;
  if (!pending) return state;
  const member = state.playerParty[pending.partyIndex];
  if (!member || slot === null) return { ...state, pendingMoves: rest };
  const updated = replaceMove(member, slot, pending.moveId);
  const playerParty = state.playerParty.map((p, idx) => (idx === pending.partyIndex ? updated : p));
  const player = pending.partyIndex === state.playerActive ? updated : state.player;
  return { ...state, playerParty, player, pendingMoves: rest };
}

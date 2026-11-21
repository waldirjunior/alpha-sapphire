import { prepareBattleEntry, refreshStats, withdrawFromBattle, type BattleMove, type PokemonInstance } from './battlePokemon';
import { expYield } from './experience';
import { gainExperience } from './levelUp';
import { addEvs } from './statSpread';
import type { BattleEvent } from './battleEvents';
import { applyEntryHazards, type BattleFieldSide, type BattleFieldState, type BattleWeather } from './battleField';

export const MAX_PARTY_SIZE = 6;
const LUCKY_EGG = 'Lucky Egg';

export type BattleStatus = 'ongoing' | 'victory' | 'defeat' | 'fled' | 'caught';
export type BattleSide = 'player' | 'enemy';

export interface PendingMoveLearn {
  partyIndex: number;
  moveId: number;
}

export interface PendingWish {
  turnsRemaining: number;
  healAmount: number;
}

export interface PendingDelayedAttack {
  turnsRemaining: number;
  source: PokemonInstance;
  move: BattleMove;
}

export interface PendingPartyRestore {
  fullPp: boolean;
}

/** `player`/`enemy` espelham sempre `playerParty[playerActive]`/`enemyParty[enemyActive]`. */
export interface BattleState {
  player: PokemonInstance;
  enemy: PokemonInstance;
  playerParty: PokemonInstance[];
  enemyParty: PokemonInstance[];
  playerActive: number;
  enemyActive: number;
  /** Índices do time do jogador que enfrentaram o inimigo ativo (divisão de XP). */
  participants: number[];
  /** Jogador precisa escolher substituto após desmaio (troca forçada, sem ação inimiga). */
  pendingSwitch: boolean;
  pendingMoves: PendingMoveLearn[];
  field: BattleFieldState;
  /** Exp. Share (item-chave Gen VI): quem não lutou recebe metade da XP e os EVs. */
  expShare: boolean;
  /** Índices do time que subiram de nível nesta batalha (candidatos à evolução ao final). */
  leveledUp: number[];
  turn: number;
  status: BattleStatus;
  log: string[];
  isTrainer?: boolean;
  trainerName?: string;
  events?: readonly BattleEvent[];
  pendingWish?: Partial<Record<BattleSide, PendingWish>>;
  delayedAttacks?: Partial<Record<BattleSide, PendingDelayedAttack>>;
  pendingPartyRestore?: Partial<Record<BattleSide, PendingPartyRestore>>;
  lastMoveUsedId?: number | null;
  biome?: 'grass' | 'water' | 'cave' | 'gym' | 'normal';
}

export function validateParty(party: readonly PokemonInstance[], owner: string): void {
  if (party.length === 0 || party.length > MAX_PARTY_SIZE) {
    throw new RangeError(`Time de ${owner} com ${party.length} Pokémon (esperado 1..${MAX_PARTY_SIZE}).`);
  }
}

export function firstHealthyIndex(party: readonly PokemonInstance[], exclude = -1): number {
  return party.findIndex((member, idx) => idx !== exclude && member.currentHp > 0);
}

export function pokemonOf(state: BattleState, side: BattleSide): PokemonInstance {
  return side === 'player' ? state.player : state.enemy;
}

export function opposite(side: BattleSide): BattleSide {
  return side === 'player' ? 'enemy' : 'player';
}

function replaceAt(party: readonly PokemonInstance[], index: number, pokemon: PokemonInstance): PokemonInstance[] {
  return party.map((member, idx) => (idx === index ? pokemon : member));
}

export function withPokemon(state: BattleState, side: BattleSide, pokemon: PokemonInstance): BattleState {
  if (side === 'player') {
    return { ...state, player: pokemon, playerParty: replaceAt(state.playerParty, state.playerActive, pokemon) };
  }
  return { ...state, enemy: pokemon, enemyParty: replaceAt(state.enemyParty, state.enemyActive, pokemon) };
}

export function curePartyStatuses(state: BattleState, side: BattleSide): BattleState {
  if (side === 'player') {
    const playerParty = state.playerParty.map((member) => member.status ? { ...member, status: null } : member);
    const player = playerParty[state.playerActive];
    return player ? { ...state, player, playerParty } : state;
  }
  const enemyParty = state.enemyParty.map((member) => member.status ? { ...member, status: null } : member);
  const enemy = enemyParty[state.enemyActive];
  return enemy ? { ...state, enemy, enemyParty } : state;
}

export function appendLog(state: BattleState, messages: readonly (string | null)[]): BattleState {
  const lines = messages.filter((line): line is string => line !== null);
  return lines.length === 0 ? state : { ...state, log: [...state.log, ...lines] };
}

/** Coloca `partyIndex` em campo; quem sai perde estágios (Gen VI) e entra como participante. */
export function switchPlayerIn(state: BattleState, partyIndex: number, batonPass = false): BattleState {
  const incoming = state.playerParty[partyIndex];
  if (!incoming || incoming.currentHp === 0 || partyIndex === state.playerActive) {
    throw new RangeError(`Troca inválida para o slot ${partyIndex} (ativo ${state.playerActive}, time de ${state.playerParty.length}).`);
  }
  const withdrawn = replaceAt(state.playerParty, state.playerActive, withdrawFromBattle(state.player));
  const entering = restoreIncoming(incomingForSwitch(state.player, incoming, batonPass), state.pendingPartyRestore?.player);
  const participants = state.participants.includes(partyIndex) ? state.participants : [...state.participants, partyIndex];
  const switched = {
    ...state,
    playerParty: replaceAt(withdrawn, partyIndex, entering),
    player: entering,
    playerActive: partyIndex,
    pendingPartyRestore: withoutSide(state.pendingPartyRestore, 'player'),
    participants,
    log: [...state.log, ...naturalCureMessage(state.player), `Vai, ${entering.species.name}!`],
  };
  return activateEntryAbility(applyHazardsOnEntry(switched, 'player'), 'player');
}

export function switchEnemyIn(state: BattleState, partyIndex: number, forced = false, batonPass = false): BattleState {
  const incoming = state.enemyParty[partyIndex];
  if (!incoming || incoming.currentHp === 0 || partyIndex === state.enemyActive) {
    throw new RangeError(`Troca inválida para o slot inimigo ${partyIndex} (ativo ${state.enemyActive}, time de ${state.enemyParty.length}).`);
  }
  const withdrawn = replaceAt(state.enemyParty, state.enemyActive, withdrawFromBattle(state.enemy));
  const entering = restoreIncoming(incomingForSwitch(state.enemy, incoming, batonPass), state.pendingPartyRestore?.enemy);
  const sent = {
    ...state,
    enemy: entering,
    enemyActive: partyIndex,
    enemyParty: replaceAt(withdrawn, partyIndex, entering),
    pendingPartyRestore: withoutSide(state.pendingPartyRestore, 'enemy'),
    participants: state.player.currentHp > 0 ? [state.playerActive] : [],
    log: [...state.log, ...naturalCureMessage(state.enemy), forced
      ? `${state.trainerName ?? 'O oponente'} foi forçado a trocar para ${entering.species.name}!`
      : `${state.trainerName ?? 'O oponente'} enviou ${entering.species.name} (Lv.${entering.level})!`],
  };
  return activateEntryAbility(applyHazardsOnEntry(sent, 'enemy'), 'enemy');
}

function restoreIncoming(pokemon: PokemonInstance, restore: PendingPartyRestore | undefined): PokemonInstance {
  if (!restore) return pokemon;
  return { ...pokemon, currentHp: pokemon.maxHp, status: null,
    moves: restore.fullPp ? pokemon.moves.map((move) => ({ ...move, currentPp: move.maxPp })) : pokemon.moves };
}

function withoutSide<T>(values: Partial<Record<BattleSide, T>> | undefined, side: BattleSide): Partial<Record<BattleSide, T>> | undefined {
  if (!values?.[side]) return values;
  const next = { ...values };
  delete next[side];
  return next;
}

function applyHazardsOnEntry(state: BattleState, side: BattleFieldSide): BattleState {
  const entry = applyEntryHazards(state.field, side, pokemonOf(state, side));
  const updated = withPokemon({ ...state, field: entry.field }, side, entry.pokemon);
  return appendLog(updated, entry.messages);
}

export function activateEntryAbility(state: BattleState, side: BattleSide): BattleState {
  const entering = pokemonOf(state, side);
  if (entering.currentHp === 0) return state;
  const weather = ENTRY_WEATHER[entering.ability];
  let next = state;
  if (weather) {
    next = {
      ...state,
      field: { ...state.field, weather: { kind: weather.kind, turns: 5 } },
      log: [...state.log, weather.message],
    };
  }
  if (entering.ability !== 'Intimidate') return next;
  const targetSide = opposite(side);
  const target = pokemonOf(next, targetSide);
  const atk = Math.max(-6, target.stages.atk - 1);
  if (atk === target.stages.atk) return next;
  const lowered = { ...target, stages: { ...target.stages, atk } };
  const updated = withPokemon(next, targetSide, lowered);
  return { ...updated, log: [...updated.log, `${target.species.name} teve o Ataque reduzido por Intimidate!`] };
}

function incomingForSwitch(outgoing: PokemonInstance, incoming: PokemonInstance, batonPass: boolean): PokemonInstance {
  const entering = prepareBattleEntry(incoming);
  if (!batonPass) return entering;
  return {
    ...entering,
    stages: outgoing.stages,
    volatile: {
      ...entering.volatile,
      substituteHp: outgoing.volatile.substituteHp ?? 0,
      focusEnergy: outgoing.volatile.focusEnergy ?? false,
      aquaRing: outgoing.volatile.aquaRing ?? false,
    },
  };
}

function naturalCureMessage(pokemon: PokemonInstance): string[] {
  return pokemon.ability === 'Natural Cure' && pokemon.status
    ? [`${pokemon.species.name} curou suas condições de status com Natural Cure!`]
    : [];
}

const ENTRY_WEATHER: Readonly<Record<string, { kind: BattleWeather; message: string }>> = {
  Drizzle: { kind: 'rain', message: 'A chuva começou a cair!' },
  Drought: { kind: 'sun', message: 'A luz do sol ficou intensa!' },
  'Sand Stream': { kind: 'sandstorm', message: 'Uma tempestade de areia começou!' },
  'Snow Warning': { kind: 'hail', message: 'Começou a nevar!' },
};

function sendNextEnemy(state: BattleState, nextIndex: number): BattleState {
  return switchEnemyIn(state, nextIndex);
}

interface ExpRecipient {
  index: number;
  participated: boolean;
}

function expRecipients(state: BattleState): ExpRecipient[] {
  return state.playerParty.flatMap((member, index) => {
    if (member.currentHp === 0) return [];
    const participated = state.participants.includes(index);
    return participated || state.expShare ? [{ index, participated }] : [];
  });
}

/** XP + EVs (Gen VI: Exp. Share também concede EVs); stats recalculados na hora. */
function rewardMember(state: BattleState, recipient: ExpRecipient): BattleState {
  const member = state.playerParty[recipient.index];
  if (!member) return state;
  const amount = expYield(state.enemy.species, state.enemy.level, {
    isTrainerBattle: state.isTrainer === true,
    participated: recipient.participated,
    holdsLuckyEgg: member.heldItem === LUCKY_EGG,
  });
  const trained = refreshStats({ ...member, evs: addEvs(member.evs, state.enemy.species.evYield) });
  const result = gainExperience(trained, amount);
  const isActive = recipient.index === state.playerActive;
  const learned = result.pendingMoves.map((moveId) => ({ partyIndex: recipient.index, moveId }));
  const next = {
    ...state,
    playerParty: replaceAt(state.playerParty, recipient.index, result.pokemon),
    player: isActive ? result.pokemon : state.player,
    pendingMoves: [...state.pendingMoves, ...learned],
    leveledUp: result.levelsGained.length > 0 && !state.leveledUp.includes(recipient.index) ? [...state.leveledUp, recipient.index] : state.leveledUp,
  };
  return appendLog(next, [`${member.species.name} ganhou ${amount} XP!`, ...result.messages]);
}

function distributeExp(state: BattleState): BattleState {
  return expRecipients(state).reduce(rewardMember, state);
}

function resolveEnemyFaint(state: BattleState): BattleState {
  const label = state.isTrainer ? 'do oponente' : 'selvagem';
  const rewarded = distributeExp(appendLog(state, [`${state.enemy.species.name} ${label} foi derrotado!`]));
  const nextIndex = firstHealthyIndex(rewarded.enemyParty, rewarded.enemyActive);
  if (nextIndex < 0) return { ...rewarded, status: 'victory' };
  return sendNextEnemy(rewarded, nextIndex);
}

function resolvePlayerFaint(state: BattleState): BattleState {
  const fainted = appendLog(state, [`${state.player.species.name} desmaiou!`]);
  if (firstHealthyIndex(fainted.playerParty) < 0) return { ...fainted, status: 'defeat' };
  return { ...appendLog(fainted, ['Escolha o próximo Pokémon!']), pendingSwitch: true };
}

/** Ao fim do turno: inimigo derrotado dá XP e o treinador envia o próximo; desmaio do jogador força troca ou derrota. */
export function resolveFaints(state: BattleState): BattleState {
  if (state.status !== 'ongoing') return state;
  const afterEnemy = state.enemy.currentHp === 0 ? resolveEnemyFaint(state) : state;
  if (afterEnemy.status !== 'ongoing') return afterEnemy;
  if (afterEnemy.enemy.currentHp === 0) return resolveFaints(afterEnemy);
  if (afterEnemy.player.currentHp !== 0) return afterEnemy;
  return resolvePlayerFaint(afterEnemy);
}

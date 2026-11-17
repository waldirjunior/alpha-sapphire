import { refreshStats, withdrawFromBattle, type PokemonInstance } from './battlePokemon';
import { expYield } from './experience';
import { gainExperience } from './levelUp';
import { addEvs } from './statSpread';

export const MAX_PARTY_SIZE = 6;
const LUCKY_EGG = 'Lucky Egg';

export type BattleStatus = 'ongoing' | 'victory' | 'defeat' | 'fled' | 'caught';
export type BattleSide = 'player' | 'enemy';

export interface PendingMoveLearn {
  partyIndex: number;
  moveId: number;
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
  /** Exp. Share (item-chave Gen VI): quem não lutou recebe metade da XP e os EVs. */
  expShare: boolean;
  /** Índices do time que subiram de nível nesta batalha (candidatos à evolução ao final). */
  leveledUp: number[];
  turn: number;
  status: BattleStatus;
  log: string[];
  isTrainer?: boolean;
  trainerName?: string;
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

export function appendLog(state: BattleState, messages: readonly (string | null)[]): BattleState {
  const lines = messages.filter((line): line is string => line !== null);
  return lines.length === 0 ? state : { ...state, log: [...state.log, ...lines] };
}

/** Coloca `partyIndex` em campo; quem sai perde estágios (Gen VI) e entra como participante. */
export function switchPlayerIn(state: BattleState, partyIndex: number): BattleState {
  const incoming = state.playerParty[partyIndex];
  if (!incoming || incoming.currentHp === 0 || partyIndex === state.playerActive) {
    throw new RangeError(`Troca inválida para o slot ${partyIndex} (ativo ${state.playerActive}, time de ${state.playerParty.length}).`);
  }
  const withdrawn = replaceAt(state.playerParty, state.playerActive, withdrawFromBattle(state.player));
  const entering = withdrawFromBattle(incoming);
  const participants = state.participants.includes(partyIndex) ? state.participants : [...state.participants, partyIndex];
  return {
    ...state,
    playerParty: replaceAt(withdrawn, partyIndex, entering),
    player: entering,
    playerActive: partyIndex,
    participants,
    log: [...state.log, `Vai, ${entering.species.name}!`],
  };
}

function sendNextEnemy(state: BattleState, nextIndex: number): BattleState {
  const entering = withdrawFromBattle(state.enemyParty[nextIndex] ?? state.enemy);
  const participants = state.player.currentHp > 0 ? [state.playerActive] : [];
  return {
    ...state,
    enemy: entering,
    enemyActive: nextIndex,
    enemyParty: replaceAt(state.enemyParty, nextIndex, entering),
    participants,
    log: [...state.log, `${state.trainerName ?? 'O oponente'} enviou ${entering.species.name} (Lv.${entering.level})!`],
  };
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
  const afterEnemy = state.enemy.currentHp === 0 ? resolveEnemyFaint(state) : state;
  if (afterEnemy.status !== 'ongoing') return afterEnemy;
  return afterEnemy.player.currentHp === 0 ? resolvePlayerFaint(afterEnemy) : afterEnemy;
}

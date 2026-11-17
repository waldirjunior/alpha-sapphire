import type { WildEncounterEntry } from '../data/pokemon/route101';
import { restoreAtPokemonCenter, withdrawFromBattle, type PokemonInstance } from './battlePokemon';
import { hasUsableMove, resolveTurn, type BattleState } from './battleTurn';
import type { Rng } from './statusConditions';

export {
  createPokemonInstance,
  type BattleMove,
  type MajorStatus,
  type MajorStatusKind,
  type PokemonInstance,
} from './battlePokemon';
export type { BattleAction, BattleState, BattleStatus } from './battleTurn';
export { calculateDamage, getTypeEffectiveness } from './damage';

const ENCOUNTER_RATE = 0.2;

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

export function startWildBattle(player: PokemonInstance, enemy: PokemonInstance): BattleState {
  return {
    player: withdrawFromBattle(player),
    enemy: withdrawFromBattle(enemy),
    turn: 1,
    status: 'ongoing',
    log: [`Um ${enemy.species.name} selvagem (Lv.${enemy.level}) apareceu!`],
  };
}

export function startTrainerBattle(
  player: PokemonInstance,
  enemy: PokemonInstance,
  trainerName: string
): BattleState {
  return {
    player: withdrawFromBattle(player),
    enemy: withdrawFromBattle(enemy),
    turn: 1,
    status: 'ongoing',
    isTrainer: true,
    trainerName,
    log: [`${trainerName} desafiou você! Ele enviou ${enemy.species.name} (Lv.${enemy.level})!`],
  };
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

export function switchActivePokemon(
  state: BattleState,
  nextPokemon: PokemonInstance,
  rng: Rng = Math.random
): BattleState {
  if (state.status !== 'ongoing' || nextPokemon.currentHp <= 0) return state;
  const switched: BattleState = {
    ...state,
    player: withdrawFromBattle(nextPokemon),
    log: [...state.log, `Vai, ${nextPokemon.species.name}!`],
  };
  return resolveTurn(switched, null, rng);
}

export function throwPokeball(state: BattleState, rng: Rng = Math.random): BattleState {
  if (state.status !== 'ongoing') return state;
  if (state.isTrainer) {
    return {
      ...state,
      log: [...state.log, 'Você não pode capturar o Pokémon de outro treinador!'],
    };
  }
  const hpRatio = state.enemy.currentHp / state.enemy.maxHp;
  const catchChance = Math.min(0.9, Math.max(0.25, 0.85 - hpRatio * 0.55));
  if (rng() < catchChance) {
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

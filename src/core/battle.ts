import type { WildEncounterEntry } from '../data/pokemon/route101';
import type { MoveDefinition, PokemonSpecies, PokemonType } from '../data/pokemon/species';

export interface PokemonInstance {
  species: PokemonSpecies;
  level: number;
  xp: number;
  nextLevelXp: number;
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
  moves: MoveDefinition[];
}

export type BattleStatus = 'ongoing' | 'victory' | 'defeat' | 'fled' | 'caught';

export interface BattleState {
  player: PokemonInstance;
  enemy: PokemonInstance;
  turn: number;
  status: BattleStatus;
  log: string[];
}

const TYPE_CHART: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  normal: {},
  grass: { water: 2, grass: 0.5, fire: 0.5, bug: 0.5 },
  fire: { grass: 2, bug: 2, fire: 0.5, water: 0.5 },
  water: { fire: 2, water: 0.5, grass: 0.5 },
  dark: { dark: 0.5 },
  bug: { grass: 2, dark: 2, fire: 0.5 },
};

const ENCOUNTER_RATE = 0.2;

function calcStat(base: number, level: number, isHp: boolean): number {
  const scaled = Math.floor((2 * base * level) / 100);
  return isHp ? scaled + level + 10 : scaled + 5;
}

export function createPokemonInstance(species: PokemonSpecies, level: number): PokemonInstance {
  if (level < 1 || level > 100) {
    throw new RangeError(`Nível inválido para ${species.name}: ${level} (esperado 1..100).`);
  }
  const maxHp = calcStat(species.baseStats.hp, level, true);
  return {
    species,
    level,
    xp: 0,
    nextLevelXp: level * level * 8,
    maxHp,
    currentHp: maxHp,
    attack: calcStat(species.baseStats.attack, level, false),
    defense: calcStat(species.baseStats.defense, level, false),
    spAtk: calcStat(species.baseStats.spAtk, level, false),
    spDef: calcStat(species.baseStats.spDef, level, false),
    speed: calcStat(species.baseStats.speed, level, false),
    moves: [...species.moves],
  };
}

function awardXp(pokemon: PokemonInstance, gainedXp: number): { updated: PokemonInstance; leveledUp: boolean } {
  let xp = pokemon.xp + gainedXp;
  let level = pokemon.level;
  let nextLevelXp = pokemon.nextLevelXp;
  let leveledUp = false;

  while (xp >= nextLevelXp && level < 100) {
    xp -= nextLevelXp;
    level += 1;
    nextLevelXp = level * level * 8;
    leveledUp = true;
  }

  if (!leveledUp) {
    return { updated: { ...pokemon, xp }, leveledUp: false };
  }

  const rebuilt = createPokemonInstance(pokemon.species, level);
  const hpDiff = Math.max(0, rebuilt.maxHp - pokemon.maxHp);
  return {
    updated: {
      ...rebuilt,
      xp,
      currentHp: Math.min(rebuilt.maxHp, pokemon.currentHp + hpDiff),
    },
    leveledUp: true,
  };
}

export function getTypeEffectiveness(moveType: PokemonType, defenderTypes: PokemonType[]): number {
  return defenderTypes.reduce(
    (mult, defType) => mult * (TYPE_CHART[moveType]?.[defType] ?? 1),
    1
  );
}

export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveDefinition,
  rng: () => number = Math.random
): number {
  const atk = move.category === 'physical' ? attacker.attack : attacker.spAtk;
  const def = move.category === 'physical' ? defender.defense : defender.spDef;
  const base = Math.floor((((2 * attacker.level) / 5 + 2) * move.power * (atk / def)) / 50) + 2;
  const stab = attacker.species.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = getTypeEffectiveness(move.type, defender.species.types);
  const randomFactor = 0.85 + 0.15 * Math.min(1, Math.max(0, rng()));
  return Math.max(1, Math.floor(base * stab * effectiveness * randomFactor));
}

export function rollWildEncounter(
  table: WildEncounterEntry[],
  triggerRng: () => number = Math.random,
  pickRng: () => number = Math.random
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
    player: { ...player },
    enemy: { ...enemy },
    turn: 1,
    status: 'ongoing',
    log: [`Um ${enemy.species.name} selvagem (Lv.${enemy.level}) apareceu!`],
  };
}

export function runFromBattle(state: BattleState): BattleState {
  if (state.status !== 'ongoing') return state;
  return {
    ...state,
    status: 'fled',
    log: [...state.log, `${state.player.species.name} fugiu da batalha!`],
  };
}

export function healParty(party: PokemonInstance[]): PokemonInstance[] {
  return party.map((pokemon) => ({ ...pokemon, currentHp: pokemon.maxHp }));
}

export function switchActivePokemon(
  state: BattleState,
  nextPokemon: PokemonInstance,
  rng: () => number = Math.random
): BattleState {
  if (state.status !== 'ongoing' || nextPokemon.currentHp <= 0) return state;

  const logs = [...state.log, `Vai, ${nextPokemon.species.name}!`];
  const enemyMove = state.enemy.moves[0];
  if (!enemyMove) {
    return { ...state, player: { ...nextPokemon }, turn: state.turn + 1, log: logs };
  }

  const res = applyAttack(state.enemy, nextPokemon, enemyMove, rng);
  logs.push(res.message);
  const nextStatus: BattleStatus = res.updatedDefender.currentHp === 0 ? 'defeat' : 'ongoing';
  return {
    ...state,
    player: res.updatedDefender,
    turn: state.turn + 1,
    status: nextStatus,
    log: logs,
  };
}

export function throwPokeball(
  state: BattleState,
  rng: () => number = Math.random
): BattleState {
  if (state.status !== 'ongoing') return state;
  const hpRatio = state.enemy.currentHp / state.enemy.maxHp;
  const catchChance = Math.min(0.9, Math.max(0.25, 0.85 - hpRatio * 0.55));
  if (rng() < catchChance) {
    return {
      ...state,
      status: 'caught',
      log: [...state.log, `Você capturou ${state.enemy.species.name}!`],
    };
  }

  const enemyMove = state.enemy.moves[0];
  if (!enemyMove) {
    return {
      ...state,
      turn: state.turn + 1,
      log: [...state.log, `${state.enemy.species.name} escapou da Poké Ball!`],
    };
  }
  const res = applyAttack(state.enemy, state.player, enemyMove, rng);
  const logs = [...state.log, `${state.enemy.species.name} escapou da Poké Ball!`, res.message];
  const nextStatus: BattleStatus = res.updatedDefender.currentHp === 0 ? 'defeat' : 'ongoing';
  return {
    ...state,
    player: res.updatedDefender,
    turn: state.turn + 1,
    status: nextStatus,
    log: logs,
  };
}

function applyAttack(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: MoveDefinition,
  rng: () => number
): { updatedDefender: PokemonInstance; message: string } {
  const dmg = calculateDamage(attacker, defender, move, rng);
  const nextHp = Math.max(0, defender.currentHp - dmg);
  const eff = getTypeEffectiveness(move.type, defender.species.types);
  const effNote = eff > 1 ? ' (Super efetivo!)' : eff < 1 ? ' (Pouco efetivo...)' : '';
  return {
    updatedDefender: { ...defender, currentHp: nextHp },
    message: `${attacker.species.name} usou ${move.name} e causou ${dmg} de dano!${effNote}`,
  };
}

export function executeBattleTurn(
  state: BattleState,
  playerMoveIndex: number,
  rng: () => number = Math.random
): BattleState {
  if (state.status !== 'ongoing') return state;

  const playerMove = state.player.moves[playerMoveIndex] ?? state.player.moves[0];
  if (!playerMove) {
    throw new Error(`Nenhum golpe disponível para ${state.player.species.name}.`);
  }
  const enemyMoveIdx = Math.floor(Math.min(0.999999, Math.max(0, rng())) * state.enemy.moves.length);
  const enemyMove = state.enemy.moves[enemyMoveIdx] ?? state.enemy.moves[0];
  if (!enemyMove) {
    throw new Error(`Nenhum golpe disponível para ${state.enemy.species.name}.`);
  }

  const playerFirst = state.player.speed >= state.enemy.speed;
  const logs = [...state.log];
  let player = { ...state.player };
  let enemy = { ...state.enemy };

  if (playerFirst) {
    const res1 = applyAttack(player, enemy, playerMove, rng);
    enemy = res1.updatedDefender;
    logs.push(res1.message);
    if (enemy.currentHp === 0) {
      const xpGain = enemy.level * 24;
      const { updated, leveledUp } = awardXp(player, xpGain);
      logs.push(`${enemy.species.name} selvagem foi derrotado! (+${xpGain} XP)`);
      if (leveledUp) logs.push(`${updated.species.name} subiu para o nível ${updated.level}!`);
      return { player: updated, enemy, turn: state.turn + 1, status: 'victory', log: logs };
    }
    const res2 = applyAttack(enemy, player, enemyMove, rng);
    player = res2.updatedDefender;
    logs.push(res2.message);
    if (player.currentHp === 0) {
      logs.push(`${player.species.name} desmaiou!`);
      return { player, enemy, turn: state.turn + 1, status: 'defeat', log: logs };
    }
  } else {
    const res1 = applyAttack(enemy, player, enemyMove, rng);
    player = res1.updatedDefender;
    logs.push(res1.message);
    if (player.currentHp === 0) {
      logs.push(`${player.species.name} desmaiou!`);
      return { player, enemy, turn: state.turn + 1, status: 'defeat', log: logs };
    }
    const res2 = applyAttack(player, enemy, playerMove, rng);
    enemy = res2.updatedDefender;
    logs.push(res2.message);
    if (enemy.currentHp === 0) {
      const xpGain = enemy.level * 24;
      const { updated, leveledUp } = awardXp(player, xpGain);
      logs.push(`${enemy.species.name} selvagem foi derrotado! (+${xpGain} XP)`);
      if (leveledUp) logs.push(`${updated.species.name} subiu para o nível ${updated.level}!`);
      return { player: updated, enemy, turn: state.turn + 1, status: 'victory', log: logs };
    }
  }

  return { player, enemy, turn: state.turn + 1, status: 'ongoing', log: logs };
}

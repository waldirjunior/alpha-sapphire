import { neutralVolatileState, pokemonTypes, type BattleMove, type MajorStatus, type MajorStatusKind, type PokemonInstance } from './battlePokemon';
import type { ElementalType } from './typeChart';
import { weatherChipDamage, type BattleWeather } from './battleField';
import { statStageMultiplier } from './statStages';

export type Rng = () => number;

// Ids 6+ da ROM são voláteis; o subconjunto entregue nesta etapa é tratado em moveExecution.
const INFLICT_KINDS: Readonly<Record<number, MajorStatusKind>> = {
  1: 'paralysis',
  2: 'sleep',
  3: 'freeze',
  4: 'burn',
  5: 'poison',
};

const IMMUNE_TYPES: Readonly<Record<MajorStatusKind, readonly ElementalType[]>> = {
  paralysis: ['electric'],
  sleep: [],
  freeze: ['ice'],
  burn: ['fire'],
  poison: ['poison', 'steel'],
  toxic: ['poison', 'steel'],
};

const STATUS_NAMES: Readonly<Record<MajorStatusKind, string>> = {
  paralysis: 'foi paralisado',
  sleep: 'adormeceu',
  freeze: 'foi congelado',
  burn: 'foi queimado',
  poison: 'foi envenenado',
  toxic: 'foi gravemente envenenado',
};

const DEFAULT_SLEEP_TURNS = { min: 2, max: 4 };
const FULL_PARALYSIS_CHANCE = 0.25;
const THAW_CHANCE = 0.2;
const BURN_POISON_FRACTION = 8;
const TOXIC_DENOMINATOR = 16;
const TOXIC_MAX_COUNTER = 15;

export function rollInRange(min: number, max: number, rng: Rng): number {
  const unit = Math.min(0.999999, Math.max(0, rng()));
  return min + Math.floor(unit * (max - min + 1));
}

/** Toxic e Poison Fang usam inflict 5 com turnMax 15 na ROM; veneno comum tem turnMax 0. */
export function statusKindForMove(move: BattleMove): MajorStatusKind | null {
  const kind = INFLICT_KINDS[move.inflict];
  if (!kind) return null;
  return kind === 'poison' && move.turnMax > 0 ? 'toxic' : kind;
}

function initialCounter(kind: MajorStatusKind, move: BattleMove, rng: Rng): number {
  if (kind === 'toxic') return 1;
  if (kind !== 'sleep') return 0;
  const min = move.turnMin || DEFAULT_SLEEP_TURNS.min;
  const max = move.turnMax || DEFAULT_SLEEP_TURNS.max;
  return rollInRange(min, max, rng);
}

export function tryInflictStatus(
  target: PokemonInstance,
  kind: MajorStatusKind,
  move: BattleMove,
  rng: Rng
): { target: PokemonInstance; message: string | null } {
  if (target.currentHp === 0 || target.status) return { target, message: null };
  if (pokemonTypes(target).some((type) => IMMUNE_TYPES[kind].includes(type))) return { target, message: null };
  const status: MajorStatus = { kind, counter: initialCounter(kind, move, rng) };
  return { target: { ...target, status }, message: `${target.species.name} ${STATUS_NAMES[kind]}!` };
}

/** Checagem antes de agir: sono decrementa, congelamento descongela 20%, paralisia trava 25%. */
export function checkCanAct(
  pokemon: PokemonInstance,
  rng: Rng,
  allowSleepTalk = false
): { pokemon: PokemonInstance; canAct: boolean; message: string | null } {
  const status = pokemon.status;
  const name = pokemon.species.name;
  if (status?.kind === 'sleep') {
    if (status.counter <= 1) return { pokemon: { ...pokemon, status: null }, canAct: true, message: `${name} acordou!` };
    return {
      pokemon: { ...pokemon, status: { ...status, counter: status.counter - 1 } },
      canAct: allowSleepTalk,
      message: `${name} está dormindo.`,
    };
  }
  if (status?.kind === 'freeze') {
    if (rng() < THAW_CHANCE) return { pokemon: { ...pokemon, status: null }, canAct: true, message: `${name} descongelou!` };
    return { pokemon, canAct: false, message: `${name} está congelado!` };
  }
  if (status?.kind === 'paralysis' && rng() < FULL_PARALYSIS_CHANCE) {
    return { pokemon, canAct: false, message: `${name} está paralisado e não consegue se mover!` };
  }
  if (pokemon.volatile.infatuated && rng() < 0.5) {
    return { pokemon, canAct: false, message: `${name} está apaixonado e não consegue se mover!` };
  }
  return checkConfusion(pokemon, rng);
}

function checkConfusion(pokemon: PokemonInstance, rng: Rng): { pokemon: PokemonInstance; canAct: boolean; message: string | null } {
  const volatile = pokemon.volatile ?? neutralVolatileState();
  if (volatile.confusionTurns <= 0) return { pokemon, canAct: true, message: null };
  const name = pokemon.species.name;
  if (volatile.confusionTurns <= 1) {
    return { pokemon: { ...pokemon, volatile: { ...volatile, confusionTurns: 0 } }, canAct: true, message: `${name} saiu de sua confusão!` };
  }
  const next = { ...pokemon, volatile: { ...volatile, confusionTurns: volatile.confusionTurns - 1 } };
  if (rng() >= 0.5) return { pokemon: next, canAct: true, message: null };
  const damage = confusionDamage(pokemon, rng);
  const sturdySaved = pokemon.ability === 'Sturdy' && pokemon.currentHp === pokemon.maxHp && damage >= pokemon.currentHp;
  const currentHp = sturdySaved ? 1 : Math.max(0, pokemon.currentHp - damage);
  return { pokemon: { ...next, currentHp }, canAct: false, message: `${name} se machucou na confusão!` };
}

function confusionDamage(pokemon: PokemonInstance, rng: Rng): number {
  const attack = Math.max(1, Math.floor(pokemon.attack * statStageMultiplier(pokemon.stages.atk)));
  const defense = Math.max(1, Math.floor(pokemon.defense * statStageMultiplier(pokemon.stages.def)));
  const base = Math.floor((((2 * pokemon.level / 5 + 2) * 40 * (attack / defense)) / 50) + 2);
  const random = 0.85 + 0.15 * Math.min(1, Math.max(0, rng()));
  return Math.max(1, Math.floor(base * random));
}

export interface VolatileTurnResult {
  pokemon: PokemonInstance;
  messages: string[];
}

export function advanceVolatileTurn(pokemon: PokemonInstance, rng: Rng = Math.random): VolatileTurnResult {
  const volatile = pokemon.volatile ?? neutralVolatileState();
  const tauntTurns = Math.max(0, volatile.tauntTurns - 1);
  const disableTurns = Math.max(0, (volatile.disableTurns ?? 0) - 1);
  const encoreTurns = Math.max(0, (volatile.encoreTurns ?? 0) - 1);
  const yawnTurns = Math.max(0, (volatile.yawnTurns ?? 0) - 1);
  const perishSongTurns = Math.max(0, (volatile.perishSongTurns ?? 0) - 1);
  const partialTrapTurns = Math.max(0, (volatile.partialTrapTurns ?? 0) - 1);
  const nextVolatile = {
    ...volatile,
    tauntTurns,
    disableTurns,
    disableMoveId: disableTurns > 0 ? volatile.disableMoveId ?? null : null,
    encoreTurns,
    encoreMoveId: encoreTurns > 0 ? volatile.encoreMoveId ?? null : null,
    yawnTurns,
    perishSongTurns,
    partialTrapTurns,
    protecting: false,
    protectionKind: null,
    enduring: false,
    magnetRiseTurns: Math.max(0, (volatile.magnetRiseTurns ?? 0) - 1),
    snatch: false,
    magicCoat: false,
    powderTurns: 0,
    electrifiedMoveId: null,
  };
  const messages: string[] = [];
  const perishExpired = (volatile.perishSongTurns ?? 0) === 1;
  const currentHp = perishExpired ? 0 : pokemon.currentHp;
  if ((volatile.perishSongTurns ?? 0) > 0) messages.push(perishMessage(pokemon, perishSongTurns));
  const status = yawnExpiredStatus(pokemon, yawnTurns, currentHp, rng, messages);
  return { pokemon: { ...pokemon, currentHp, status, volatile: nextVolatile }, messages };
}

function perishMessage(pokemon: PokemonInstance, turns: number): string {
  return `A contagem de Perish Song de ${pokemon.species.name} caiu para ${turns}!`;
}

function yawnExpiredStatus(
  pokemon: PokemonInstance,
  yawnTurns: number,
  currentHp: number,
  rng: Rng,
  messages: string[]
): MajorStatus | null {
  const hadYawn = (pokemon.volatile.yawnTurns ?? 0) > 0;
  if (!hadYawn || yawnTurns > 0 || currentHp === 0 || pokemon.status) return pokemon.status;
  if (['Insomnia', 'Vital Spirit', 'Sweet Veil'].includes(pokemon.ability)) return pokemon.status;
  messages.push(`${pokemon.species.name} adormeceu!`);
  return { kind: 'sleep', counter: rollInRange(2, 4, rng) };
}

/** Dano residual de fim de turno (Gen VI): queimadura/veneno 1/8, tóxico n/16 crescente. */
export function applyResidualDamage(
  pokemon: PokemonInstance,
  weather: BattleWeather | null = null,
  weatherSuppressed = false
): { pokemon: PokemonInstance; message: string | null; leechSeedDrain: number } {
  if (pokemon.currentHp === 0) return { pokemon, message: null, leechSeedDrain: 0 };
  const seed = leechSeedResidual(pokemon);
  const trap = seed.pokemon.currentHp > 0 ? partialTrapResidual(seed.pokemon) : { pokemon: seed.pokemon, message: null };
  const statusDamage = trap.pokemon.currentHp > 0
    ? statusResidual(trap.pokemon, trap.pokemon.status)
    : { pokemon: trap.pokemon, message: null };
  const weatherDamage = statusDamage.pokemon.currentHp > 0
    ? weatherChipDamage(statusDamage.pokemon, weather, weatherSuppressed) : 0;
  const currentHp = Math.max(0, statusDamage.pokemon.currentHp - weatherDamage);
  const weatherMessage = weatherDamage > 0 && statusDamage.pokemon.currentHp > 0
    ? `${pokemon.species.name} sofreu ${weatherDamage} de dano do clima.` : null;
  const result = weatherDamage > 0 ? { ...statusDamage.pokemon, currentHp } : statusDamage.pokemon;
  const cursed = curseResidual(result);
  const ring = aquaRingResidual(cursed.pokemon);
  return {
    pokemon: ring.pokemon,
    message: [seed.message, trap.message, statusDamage.message, weatherMessage, cursed.message, ring.message].filter(Boolean).join(' ') || null,
    leechSeedDrain: seed.damage,
  };
}

function curseResidual(pokemon: PokemonInstance): { pokemon: PokemonInstance; message: string | null } {
  if (!pokemon.volatile.cursed || pokemon.currentHp === 0 || pokemon.ability === 'Magic Guard') return { pokemon, message: null };
  const damage = Math.min(pokemon.currentHp, Math.max(1, Math.floor(pokemon.maxHp / 4)));
  return {
    pokemon: { ...pokemon, currentHp: pokemon.currentHp - damage },
    message: `${pokemon.species.name} perdeu ${damage} HP para a maldição.`,
  };
}

function aquaRingResidual(pokemon: PokemonInstance): { pokemon: PokemonInstance; message: string | null } {
  if (!pokemon.volatile.aquaRing || pokemon.currentHp === 0) return { pokemon, message: null };
  const healed = Math.min(pokemon.maxHp, pokemon.currentHp + Math.max(1, Math.floor(pokemon.maxHp / 16)));
  if (healed === pokemon.currentHp) return { pokemon, message: null };
  return {
    pokemon: { ...pokemon, currentHp: healed },
    message: `${pokemon.species.name} recuperou HP com Aqua Ring.`,
  };
}

function leechSeedResidual(pokemon: PokemonInstance): { pokemon: PokemonInstance; damage: number; message: string | null } {
  if (!pokemon.volatile?.leechSeeded || pokemon.currentHp === 0 || pokemon.ability === 'Magic Guard') {
    return { pokemon, damage: 0, message: null };
  }
  const damage = Math.min(pokemon.currentHp, Math.max(1, Math.floor(pokemon.maxHp / 8)));
  return {
    pokemon: { ...pokemon, currentHp: pokemon.currentHp - damage },
    damage,
    message: `${pokemon.species.name} perdeu ${damage} HP para Leech Seed.`,
  };
}

function partialTrapResidual(pokemon: PokemonInstance): { pokemon: PokemonInstance; message: string | null } {
  if ((pokemon.volatile.partialTrapTurns ?? 0) <= 0 || pokemon.currentHp === 0 || pokemon.ability === 'Magic Guard') {
    return { pokemon, message: null };
  }
  const damage = Math.min(pokemon.currentHp, Math.max(1, Math.floor(pokemon.maxHp / 8)));
  return {
    pokemon: { ...pokemon, currentHp: pokemon.currentHp - damage },
    message: `${pokemon.species.name} perdeu ${damage} HP por estar preso.`,
  };
}

function statusResidual(pokemon: PokemonInstance, status: MajorStatus | null): { pokemon: PokemonInstance; message: string | null } {
  if (!status) return { pokemon, message: null };
  if (status.kind === 'burn' || status.kind === 'poison') {
    if (pokemon.ability === 'Magic Guard') return { pokemon, message: null };
    const damage = Math.max(1, Math.floor(pokemon.maxHp / BURN_POISON_FRACTION));
    const verb = status.kind === 'burn' ? 'sofre com a queimadura' : 'sofre com o veneno';
    return residual(pokemon, damage, status, verb);
  }
  if (status.kind !== 'toxic') return { pokemon, message: null };
  const nextStatus = { kind: 'toxic' as const, counter: Math.min(TOXIC_MAX_COUNTER, status.counter + 1) };
  if (pokemon.ability === 'Magic Guard') return { pokemon: { ...pokemon, status: nextStatus }, message: null };
  const damage = Math.max(1, Math.floor((pokemon.maxHp * status.counter) / TOXIC_DENOMINATOR));
  return residual(pokemon, damage, nextStatus, 'sofre com o veneno');
}

function residual(pokemon: PokemonInstance, damage: number, status: MajorStatus, verb: string): { pokemon: PokemonInstance; message: string } {
  const currentHp = Math.max(0, pokemon.currentHp - damage);
  return { pokemon: { ...pokemon, currentHp, status }, message: `${pokemon.species.name} ${verb} (-${damage} HP).` };
}

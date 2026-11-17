import type { BattleMove, MajorStatus, MajorStatusKind, PokemonInstance } from './battlePokemon';
import type { ElementalType } from './typeChart';

export type Rng = () => number;

// Ids de infligir da ROM (Move6.Inflict, pk3DS MoveEditor6); 6+ são voláteis ainda não simulados (P-010).
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
  if (target.species.types.some((type) => IMMUNE_TYPES[kind].includes(type))) return { target, message: null };
  const status: MajorStatus = { kind, counter: initialCounter(kind, move, rng) };
  return { target: { ...target, status }, message: `${target.species.name} ${STATUS_NAMES[kind]}!` };
}

/** Checagem antes de agir: sono decrementa, congelamento descongela 20%, paralisia trava 25%. */
export function checkCanAct(pokemon: PokemonInstance, rng: Rng): { pokemon: PokemonInstance; canAct: boolean; message: string | null } {
  const status = pokemon.status;
  const name = pokemon.species.name;
  if (status?.kind === 'sleep') {
    if (status.counter <= 1) return { pokemon: { ...pokemon, status: null }, canAct: true, message: `${name} acordou!` };
    return { pokemon: { ...pokemon, status: { ...status, counter: status.counter - 1 } }, canAct: false, message: `${name} está dormindo.` };
  }
  if (status?.kind === 'freeze') {
    if (rng() < THAW_CHANCE) return { pokemon: { ...pokemon, status: null }, canAct: true, message: `${name} descongelou!` };
    return { pokemon, canAct: false, message: `${name} está congelado!` };
  }
  if (status?.kind === 'paralysis' && rng() < FULL_PARALYSIS_CHANCE) {
    return { pokemon, canAct: false, message: `${name} está paralisado e não consegue se mover!` };
  }
  return { pokemon, canAct: true, message: null };
}

/** Dano residual de fim de turno (Gen VI): queimadura/veneno 1/8, tóxico n/16 crescente. */
export function applyResidualDamage(pokemon: PokemonInstance): { pokemon: PokemonInstance; message: string | null } {
  const status = pokemon.status;
  if (pokemon.currentHp === 0 || !status) return { pokemon, message: null };
  if (status.kind === 'burn' || status.kind === 'poison') {
    const damage = Math.max(1, Math.floor(pokemon.maxHp / BURN_POISON_FRACTION));
    const verb = status.kind === 'burn' ? 'sofre com a queimadura' : 'sofre com o veneno';
    return residual(pokemon, damage, status, verb);
  }
  if (status.kind === 'toxic') {
    const damage = Math.max(1, Math.floor((pokemon.maxHp * status.counter) / TOXIC_DENOMINATOR));
    const nextStatus = { kind: 'toxic' as const, counter: Math.min(TOXIC_MAX_COUNTER, status.counter + 1) };
    return residual(pokemon, damage, nextStatus, 'sofre com o veneno');
  }
  return { pokemon, message: null };
}

function residual(pokemon: PokemonInstance, damage: number, status: MajorStatus, verb: string): { pokemon: PokemonInstance; message: string } {
  const currentHp = Math.max(0, pokemon.currentHp - damage);
  return { pokemon: { ...pokemon, currentHp, status }, message: `${pokemon.species.name} ${verb} (-${damage} HP).` };
}

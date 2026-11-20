import type { BattleMove, PokemonInstance } from './battlePokemon';
import { moveEffectiveness } from './damage';
import { getMoveById } from './dex';
import { accuracyStageMultiplier } from './statStages';
import { statusKindForMove, tryInflictStatus, type Rng } from './statusConditions';
import type { BattleHazards, BattleScreen, BattleScreenState, BattleWeather, BattleWeatherState, EntryHazard } from './battleField';
import { executeDamagingMove, executeOneHitKnockout } from './battleDamageExecution';
import { applyStatChanges, inflictConfusion } from './battleMoveEffects';
import { attractMove, disableMove, encoreMove, perishSongMove, yawnMove } from './battleVolatileMoves';

export interface MoveOutcome {
  user: PokemonInstance;
  target: PokemonInstance;
  messages: string[];
  flinched: boolean;
  fieldUpdate?: { weather?: BattleWeatherState | null; screen?: BattleScreen; hazard?: EntryHazard; clearHazards?: 'user' | 'both'; clearScreens?: boolean };
  forceSwitch?: boolean;
  switchUser?: boolean;
  batonPass?: boolean;
  hitSubstitute?: boolean;
}

export interface MoveExecutionContext {
  weather?: BattleWeatherState | null;
  weatherSuppressed?: boolean;
  userScreens?: BattleScreenState;
  targetScreens?: BattleScreenState;
  targetHazards?: BattleHazards;
  targetMoveCategory?: BattleMove['category'] | null;
}

export const ALWAYS_HITS_ACCURACY = 101;
const PRESSURE_ABILITY = 'Pressure';
const SELF_TARGET = 7;
// MoveTarget da ROM que atingem o oponente (pk3DS MoveTarget): AnyExceptSelf, Opponent, AllAdjacent, AllAdjacentOpponents, All, RandomOpponent.
const FOE_TARGETS: ReadonlySet<number> = new Set([0, 3, 4, 5, 8, 9]);
// MoveQuality (pk3DS): 1 status, 2 estágios, 3 cura, 4 dano+status, 6 dano−alvo, 7 dano+usuário, 8 dreno.
const QUALITY_INFLICT = 1;
const QUALITY_STAGES = 2;
const QUALITY_HEAL = 3;
const QUALITY_SWAGGER = 5;
const QUALITY_FIELD = 11;
const QUALITY_FORCE_SWITCH = 12;
const QUALITY_PROTECT = 13;
const CHARGE_MOVE_NAMES: ReadonlySet<string> = new Set(['Fly', 'Dig', 'Solar Beam']);

export function targetsFoe(move: BattleMove): boolean {
  return FOE_TARGETS.has(move.target);
}

/** Pressure (Gen VI): golpes que miram o portador gastam 1 PP extra. */
export function spendPp(user: PokemonInstance, moveIndex: number, target: PokemonInstance): PokemonInstance {
  const move = user.moves[moveIndex];
  if (!move) return user;
  const cost = targetsFoe(move) && target.ability === PRESSURE_ABILITY ? 2 : 1;
  const moves = user.moves.map((slot, idx) => (idx === moveIndex ? { ...slot, currentPp: Math.max(0, slot.currentPp - cost) } : slot));
  return { ...user, moves };
}

export function rollAccuracy(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng): boolean {
  if (isUntargetableInCharge(target, move)) return false;
  if (move.accuracy === ALWAYS_HITS_ACCURACY || !targetsFoe(move)) return true;
  const threshold = move.quality === 9 ? ohkoAccuracy(user, target, move) : move.accuracy * accuracyStageMultiplier(user.stages.accuracy, target.stages.evasion);
  if (threshold === 0) return false;
  return Math.min(0.999999, Math.max(0, rng())) * 100 < threshold;
}

export function executeMove(
  user: PokemonInstance,
  target: PokemonInstance,
  move: BattleMove,
  rng: Rng,
  context: MoveExecutionContext = {}
): MoveOutcome {
  const charge = prepareCharge(user, target, move);
  if (charge) return charge;
  const readyUser = clearCompletedCharge(user, move);
  if (targetsFoe(move) && move.category === 'status' && move.name !== 'Perish Song' && (target.volatile.substituteHp ?? 0) > 0) {
    return { user: readyUser, target, messages: [`O substituto de ${target.species.name} protegeu o alvo!`], flinched: false };
  }
  if (move.name === 'Sucker Punch' && !isDamagingCategory(context.targetMoveCategory)) {
    return { user: readyUser, target, messages: [`${readyUser.species.name} usou Sucker Punch, mas falhou!`], flinched: false };
  }
  if (!rollAccuracy(readyUser, target, move, rng)) {
    return { user: readyUser, target, messages: [`${readyUser.species.name} usou ${move.name}, mas errou!`], flinched: false };
  }
  if (move.quality === 9) {
    if (moveEffectiveness(move, target) === 0) return ineffectiveMove(readyUser, target, move);
    return executeOneHitKnockout(readyUser, target, move);
  }
  return move.category === 'status'
    ? executeStatusMove(readyUser, target, move, rng, context)
    : executeDamagingMove(readyUser, target, move, rng, context);
}

function prepareCharge(user: PokemonInstance, target: PokemonInstance, move: BattleMove): MoveOutcome | null {
  if (!isChargeMove(move) || user.volatile.chargeMoveId === move.id) return null;
  const phrase = move.name === 'Fly' ? 'começou a voar' : move.name === 'Dig' ? 'cavou para baixo' : 'começou a absorver luz';
  return {
    user: { ...user, volatile: { ...user.volatile, chargeMoveId: move.id } },
    target,
    messages: [`${user.species.name} ${phrase}!`],
    flinched: false,
  };
}

export function isChargeMove(move: BattleMove): boolean {
  return CHARGE_MOVE_NAMES.has(move.name);
}

function clearCompletedCharge(user: PokemonInstance, move: BattleMove): PokemonInstance {
  if (user.volatile.chargeMoveId !== move.id) return user;
  return { ...user, volatile: { ...user.volatile, chargeMoveId: null } };
}

function isUntargetableInCharge(target: PokemonInstance, move: BattleMove): boolean {
  const chargedMoveId = target.volatile.chargeMoveId;
  if (chargedMoveId === undefined || chargedMoveId === null) return false;
  const chargedName = getMoveById(chargedMoveId).name;
  return targetsFoe(move) && move.category !== 'status' && (chargedName === 'Fly' || chargedName === 'Dig');
}

function executeStatusMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng, context: MoveExecutionContext): MoveOutcome {
  const used = `${user.species.name} usou ${move.name}!`;
  if (move.quality === 10) return setWeather(user, target, move, context.weather ?? null, used);
  if (move.quality === QUALITY_FIELD && hazardForMove(move.name)) return setEntryHazardMove(user, target, move, context.targetHazards, used);
  if (move.quality === 11) return setScreen(user, target, move, context.userScreens, used);
  if (move.quality === QUALITY_HEAL) return healUser(user, target, move, used);
  if (move.quality === QUALITY_INFLICT) return inflictFromStatusMove(user, target, move, rng, used);
  if (move.quality === QUALITY_FORCE_SWITCH) return { user, target, messages: [used], flinched: false, forceSwitch: true };
  if (move.quality === QUALITY_SWAGGER) return swaggerMove(user, target, move, rng, used);
  if (move.quality === QUALITY_PROTECT) return executeQualityThirteen(user, target, move, rng, used);
  if (move.name === 'Attract') return attractMove(user, target, used);
  if (move.name === 'Yawn') return yawnMove(user, target, used);
  if (move.name === 'Perish Song') return perishSongMove(user, target, used);
  if (move.quality === QUALITY_STAGES) {
    const selfTarget = move.target === SELF_TARGET;
    const changed = applyStatChanges(selfTarget ? user : target, move.statChanges, rng, true);
    const outcome = selfTarget ? { user: changed.pokemon, target } : { user, target: changed.pokemon };
    return { ...outcome, messages: [used, ...orFailed(changed.messages)], flinched: false };
  }
  return { user, target, messages: [used, `O efeito de ${move.name} ainda não é simulado (P-010).`], flinched: false };
}

function setEntryHazardMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, current: BattleHazards | undefined, used: string): MoveOutcome {
  const hazard = hazardForMove(move.name);
  if (!hazard) return unsupportedMove(user, target, move, used);
  if (current && hazardAtCapacity(current, hazard)) return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
  return { user, target, messages: [used, 'Perigos espalhados pelo lado adversário!'], flinched: false, fieldUpdate: { hazard } };
}

function hazardAtCapacity(current: BattleHazards, hazard: EntryHazard): boolean {
  if (hazard === 'spikes') return current.spikes >= 3;
  if (hazard === 'toxicSpikes') return current.toxicSpikes >= 2;
  return current[hazard];
}

function hazardForMove(name: string): EntryHazard | null {
  const hazards: Readonly<Record<string, EntryHazard>> = {
    'Stealth Rock': 'stealthRock', Spikes: 'spikes', 'Toxic Spikes': 'toxicSpikes', 'Sticky Web': 'stickyWeb',
  };
  return hazards[name] ?? null;
}

function swaggerMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng, used: string): MoveOutcome {
  const changed = applyStatChanges(target, move.statChanges, rng, true);
  const confused = inflictConfusion(changed.pokemon, move, rng);
  return { user, target: confused.target, messages: [used, ...orFailed(changed.messages), confused.message ?? 'Mas não teve efeito!'], flinched: false };
}

function executeQualityThirteen(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng, used: string): MoveOutcome {
  if (move.name === 'Splash') return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
  if (move.name === 'Protect' || move.name === 'Detect') return protectMove(user, target, rng, used);
  if (move.name === 'Baton Pass') return { user, target, messages: [used], flinched: false, switchUser: true, batonPass: true };
  if (move.name === 'Taunt') return tauntMove(user, target, used);
  if (move.name === 'Disable') return disableMove(user, target, used);
  if (move.name === 'Encore') return encoreMove(user, target, used);
  if (move.name === 'Substitute') return substituteMove(user, target, used);
  if (move.name === 'Defog') return { user, target, messages: [used, 'Os perigos e barreiras foram dissipados!'], flinched: false,
    fieldUpdate: { clearHazards: 'both', clearScreens: true } };
  return unsupportedMove(user, target, move, used);
}

function substituteMove(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const cost = Math.max(1, Math.floor(user.maxHp / 4));
  if ((user.volatile.substituteHp ?? 0) > 0 || user.currentHp <= cost) {
    return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
  }
  const created = {
    ...user,
    currentHp: user.currentHp - cost,
    volatile: { ...user.volatile, substituteHp: cost },
  };
  return { user: created, target, messages: [used, `${user.species.name} criou um substituto!`], flinched: false };
}

function protectMove(user: PokemonInstance, target: PokemonInstance, rng: Rng, used: string): MoveOutcome {
  const volatile = user.volatile;
  const successChance = 1 / (2 ** volatile.protectStreak);
  if (Math.min(0.999999, Math.max(0, rng())) >= successChance) {
    return { user: { ...user, volatile: { ...volatile, protectStreak: 0, protecting: false } }, target,
      messages: [used, `${user.species.name} não conseguiu se proteger!`], flinched: false };
  }
  const protectedUser = { ...user, volatile: { ...volatile, protectStreak: volatile.protectStreak + 1, protecting: true } };
  return { user: protectedUser, target, messages: [used, `${user.species.name} se protegeu!`], flinched: false };
}

function tauntMove(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const result = inflictTaunt(target);
  return { user, target: result.target, messages: [used, result.message ?? 'Mas não teve efeito!'], flinched: false };
}

function inflictTaunt(target: PokemonInstance): { target: PokemonInstance; message: string | null } {
  if (target.currentHp === 0 || target.volatile.tauntTurns > 0) return { target, message: null };
  return { target: { ...target, volatile: { ...target.volatile, tauntTurns: 3 } }, message: `${target.species.name} foi provocado!` };
}

function isDamagingCategory(category: BattleMove['category'] | null | undefined): boolean {
  return category === 'physical' || category === 'special';
}

function inflictLeechSeed(target: PokemonInstance): { target: PokemonInstance; message: string | null } {
  if (target.currentHp === 0 || target.volatile.leechSeeded || target.species.types.includes('grass')) return { target, message: null };
  return { target: { ...target, volatile: { ...target.volatile, leechSeeded: true } }, message: `${target.species.name} foi semeado!` };
}

function setWeather(
  user: PokemonInstance,
  target: PokemonInstance,
  move: BattleMove,
  current: BattleWeatherState | null,
  used: string
): MoveOutcome {
  const kind = weatherForMove(move.name);
  if (!kind) return unsupportedMove(user, target, move, used);
  if (current?.kind === kind) return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
  return { user, target, messages: [used, weatherStartMessage(kind)], flinched: false, fieldUpdate: { weather: { kind, turns: 5 } } };
}

function setScreen(
  user: PokemonInstance,
  target: PokemonInstance,
  move: BattleMove,
  current: BattleScreenState | undefined,
  used: string
): MoveOutcome {
  const kind = screenForMove(move.name);
  if (!kind) return unsupportedMove(user, target, move, used);
  if ((current?.[kind] ?? 0) > 0) return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
  return { user, target, messages: [used, `O ${move.name} protegeu o time!`], flinched: false, fieldUpdate: { screen: kind } };
}

function unsupportedMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, used: string): MoveOutcome {
  return { user, target, messages: [used, `O efeito de ${move.name} ainda não é simulado (P-010).`], flinched: false };
}

function weatherForMove(name: string): BattleWeather | null {
  const weather: Readonly<Record<string, BattleWeather>> = {
    'Sunny Day': 'sun',
    'Rain Dance': 'rain',
    Sandstorm: 'sandstorm',
    Hail: 'hail',
  };
  return weather[name] ?? null;
}

function screenForMove(name: string): BattleScreen | null {
  if (name === 'Reflect') return 'reflect';
  return name === 'Light Screen' ? 'lightScreen' : null;
}

function weatherStartMessage(weather: BattleWeather): string {
  const messages: Readonly<Record<BattleWeather, string>> = {
    sun: 'A luz do sol ficou intensa!',
    rain: 'Começou a chover!',
    sandstorm: 'Uma tempestade de areia começou!',
    hail: 'Começou a cair granizo!',
  };
  return messages[weather];
}

function ohkoAccuracy(user: PokemonInstance, target: PokemonInstance, move: BattleMove): number {
  if (user.level < target.level) return 0;
  const base = move.name === 'Sheer Cold' && !user.species.types.includes('ice') ? 20 : move.accuracy;
  return Math.min(100, base + user.level - target.level);
}

function ineffectiveMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove): MoveOutcome {
  return { user, target, messages: [`${user.species.name} usou ${move.name}, mas não afeta ${target.species.name}...`], flinched: false };
}

function orFailed(messages: string[]): string[] {
  return messages.length > 0 ? messages : ['Mas não teve efeito!'];
}

function healUser(user: PokemonInstance, target: PokemonInstance, move: BattleMove, used: string): MoveOutcome {
  const amount = Math.max(1, Math.floor((user.maxHp * move.healPercent) / 100));
  const currentHp = Math.min(user.maxHp, user.currentHp + amount);
  const healed = currentHp - user.currentHp;
  const message = healed > 0 ? `${user.species.name} recuperou ${healed} HP.` : 'Mas não teve efeito!';
  return { user: { ...user, currentHp }, target, messages: [used, message], flinched: false };
}

function inflictFromStatusMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng, used: string): MoveOutcome {
  if (move.inflict === 6) {
    const result = inflictConfusion(target, move, rng);
    return { user, target: result.target, messages: [used, result.message ?? 'Mas não teve efeito!'], flinched: false };
  }
  if (move.inflict === 18) {
    const result = inflictLeechSeed(target);
    return { user, target: result.target, messages: [used, result.message ?? 'Mas não teve efeito!'], flinched: false };
  }
  if (move.inflict === 7) return attractMove(user, target, used);
  if (move.inflict === 14) return yawnMove(user, target, used);
  if (move.inflict === 20) return perishSongMove(user, target, used);
  const kind = statusKindForMove(move);
  if (!kind) {
    return { user, target, messages: [used, `O efeito de ${move.name} ainda não é simulado (P-010).`], flinched: false };
  }
  const result = tryInflictStatus(target, kind, move, rng);
  return { user, target: result.target, messages: [used, result.message ?? 'Mas não teve efeito!'], flinched: false };
}

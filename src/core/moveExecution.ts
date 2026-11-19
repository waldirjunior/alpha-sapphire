import type { BattleMove, PokemonInstance } from './battlePokemon';
import { calculateDamage, moveEffectiveness, rollCritical, rollHitCount } from './damage';
import type { DexStatChange } from './dex';
import { accuracyStageMultiplier, applyStageDelta, STAT_LABELS, statsForRomId } from './statStages';
import { rollInRange, statusKindForMove, tryInflictStatus, type Rng } from './statusConditions';
import type { BattleHazards, BattleScreen, BattleScreenState, BattleWeather, BattleWeatherState, EntryHazard } from './battleField';

export interface MoveOutcome {
  user: PokemonInstance;
  target: PokemonInstance;
  messages: string[];
  flinched: boolean;
  fieldUpdate?: { weather?: BattleWeatherState | null; screen?: BattleScreen; hazard?: EntryHazard; clearHazards?: 'user' | 'both'; clearScreens?: boolean };
  forceSwitch?: boolean;
}

export interface MoveExecutionContext {
  weather?: BattleWeatherState | null;
  weatherSuppressed?: boolean;
  userScreens?: BattleScreenState;
  targetScreens?: BattleScreenState;
  targetHazards?: BattleHazards;
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
const QUALITY_RAISE_USER = 7;
const QUALITY_SWAGGER = 5;
const QUALITY_FIELD = 11;
const QUALITY_FORCE_SWITCH = 12;
const QUALITY_PROTECT = 13;

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
  if (!rollAccuracy(user, target, move, rng)) {
    return { user, target, messages: [`${user.species.name} usou ${move.name}, mas errou!`], flinched: false };
  }
  if (move.quality === 9) {
    if (moveEffectiveness(move, target) === 0) return ineffectiveMove(user, target, move);
    return executeOneHitKnockout(user, target, move);
  }
  return move.category === 'status'
    ? executeStatusMove(user, target, move, rng, context)
    : executeDamagingMove(user, target, move, rng, context);
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
  if (move.name === 'Protect' || move.name === 'Detect') return protectMove(user, target, rng, used);
  if (move.name === 'Taunt') return tauntMove(user, target, used);
  if (move.name === 'Defog') return { user, target, messages: [used, 'Os perigos e barreiras foram dissipados!'], flinched: false,
    fieldUpdate: { clearHazards: 'both', clearScreens: true } };
  return unsupportedMove(user, target, move, used);
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

function inflictConfusion(target: PokemonInstance, move: BattleMove, rng: Rng): { target: PokemonInstance; message: string | null } {
  if (target.currentHp === 0 || target.ability === 'Own Tempo' || target.volatile.confusionTurns > 0) return { target, message: null };
  const turns = rollInRange(move.turnMin || 2, move.turnMax || 5, rng);
  return { target: { ...target, volatile: { ...target.volatile, confusionTurns: turns } }, message: `${target.species.name} ficou confuso!` };
}

function inflictTaunt(target: PokemonInstance): { target: PokemonInstance; message: string | null } {
  if (target.currentHp === 0 || target.volatile.tauntTurns > 0) return { target, message: null };
  return { target: { ...target, volatile: { ...target.volatile, tauntTurns: 3 } }, message: `${target.species.name} foi provocado!` };
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

function executeOneHitKnockout(user: PokemonInstance, target: PokemonInstance, move: BattleMove): MoveOutcome {
  const used = `${user.species.name} usou ${move.name}!`;
  if (target.ability === 'Sturdy') return { user, target, messages: [used, `A habilidade Sturdy de ${target.species.name} impediu o nocaute!`], flinched: false };
  return { user, target: { ...target, currentHp: 0 }, messages: [used, 'Nocaute em um golpe!'], flinched: false };
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
  const kind = statusKindForMove(move);
  if (!kind) {
    return { user, target, messages: [used, `O efeito de ${move.name} ainda não é simulado (P-010).`], flinched: false };
  }
  const result = tryInflictStatus(target, kind, move, rng);
  return { user, target: result.target, messages: [used, result.message ?? 'Mas não teve efeito!'], flinched: false };
}

function applyStatChanges(
  pokemon: PokemonInstance,
  changes: readonly DexStatChange[],
  rng: Rng,
  guaranteed: boolean
): { pokemon: PokemonInstance; messages: string[] } {
  let current = pokemon;
  const messages: string[] = [];
  for (const change of changes) {
    if (!guaranteed && change.percent > 0 && rng() * 100 >= change.percent) continue;
    for (const stat of statsForRomId(change.stat)) {
      const { stages, applied } = applyStageDelta(current.stages, stat, change.stages);
      current = { ...current, stages };
      messages.push(stageMessage(current, STAT_LABELS[stat], applied, change.stages));
    }
  }
  return { pokemon: current, messages };
}

function stageMessage(pokemon: PokemonInstance, label: string, applied: number, requested: number): string {
  const name = pokemon.species.name;
  if (applied === 0) return `${label} de ${name} não pode ${requested > 0 ? 'subir' : 'cair'} mais!`;
  const size = Math.abs(applied) >= 2 ? ' muito' : '';
  return `${label} de ${name}${size} ${applied > 0 ? 'subiu' : 'caiu'}!`;
}

function executeDamagingMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng, context: MoveExecutionContext): MoveOutcome {
  const effectiveness = moveEffectiveness(move, target);
  if (effectiveness === 0) {
    return { user, target, messages: [`${user.species.name} usou ${move.name}, mas não afeta ${target.species.name}...`], flinched: false };
  }
  const hits = rollHitCount(move, rng);
  let defender = target;
  let total = 0;
  let crits = 0;
  for (let hit = 0; hit < hits && defender.currentHp > 0; hit += 1) {
    const critical = rollCritical(defender, move, rng, user);
    const dmg = calculateDamage(user, defender, move, rng, damageOptions(move, context, critical));
    defender = applySturdy(defender, dmg);
    total += dmg;
    crits += critical ? 1 : 0;
  }
  const effNote = effectiveness > 1 ? ' (Super efetivo!)' : effectiveness < 1 ? ' (Pouco efetivo...)' : '';
  const hitNote = hits > 1 ? ` em ${hits} golpes` : '';
  const critNote = crits > 0 ? ' Acerto crítico!' : '';
  const messages = [`${user.species.name} usou ${move.name} e causou ${total} de dano${hitNote}!${effNote}${critNote}`];
  const outcome = applyAfterDamage({ user, target: defender, messages, flinched: false }, move, total, rng);
  return move.name === 'Rapid Spin' && total > 0 ? { ...outcome, fieldUpdate: { clearHazards: 'user' } } : outcome;
}

function damageOptions(move: BattleMove, context: MoveExecutionContext, critical: boolean) {
  return {
    critical,
    weather: context.weather?.kind ?? null,
    weatherSuppressed: context.weatherSuppressed ?? false,
    screen: activeScreen(move, context.targetScreens),
  };
}

function activeScreen(move: BattleMove, screens: BattleScreenState | undefined): BattleScreen | null {
  if (move.category === 'physical') return (screens?.reflect ?? 0) > 0 ? 'reflect' : null;
  return (screens?.lightScreen ?? 0) > 0 ? 'lightScreen' : null;
}

function applySturdy(target: PokemonInstance, damage: number): PokemonInstance {
  const hpAfterHit = Math.max(0, target.currentHp - damage);
  const sturdySaved = target.ability === 'Sturdy' && target.currentHp === target.maxHp && hpAfterHit === 0;
  return { ...target, currentHp: sturdySaved ? 1 : hpAfterHit };
}

function applyAfterDamage(outcome: MoveOutcome, move: BattleMove, damage: number, rng: Rng): MoveOutcome {
  const withHp = applyHpSideEffects(outcome, move, damage);
  const withStatus = applySecondaryStatus(withHp, move, rng);
  const withStages = applySecondaryStages(withStatus, move, rng);
  const flinched = withStages.target.currentHp > 0 && move.flinchPercent > 0 && rng() * 100 < move.flinchPercent;
  return { ...withStages, flinched };
}

function applyHpSideEffects(outcome: MoveOutcome, move: BattleMove, damage: number): MoveOutcome {
  const { user } = outcome;
  let delta = 0;
  if (move.recoilPercent !== 0) delta += Math.sign(move.recoilPercent) * Math.max(1, Math.floor((damage * Math.abs(move.recoilPercent)) / 100));
  if (move.healPercent < 0) delta -= Math.max(1, Math.floor((user.maxHp * -move.healPercent) / 100));
  if (delta === 0) return outcome;
  const currentHp = Math.max(0, Math.min(user.maxHp, user.currentHp + delta));
  const note = delta > 0 ? `${user.species.name} drenou ${currentHp - user.currentHp} HP.` : `${user.species.name} sofreu ${user.currentHp - currentHp} de dano de recuo.`;
  return { ...outcome, user: { ...user, currentHp }, messages: [...outcome.messages, note] };
}

function applySecondaryStatus(outcome: MoveOutcome, move: BattleMove, rng: Rng): MoveOutcome {
  if (move.inflict === 6 && outcome.target.currentHp > 0 && rng() * 100 < move.inflictPercent) {
    const result = inflictConfusion(outcome.target, move, rng);
    return result.message ? { ...outcome, target: result.target, messages: [...outcome.messages, result.message] } : outcome;
  }
  const kind = statusKindForMove(move);
  if (!kind || outcome.target.currentHp === 0 || rng() * 100 >= move.inflictPercent) return outcome;
  const result = tryInflictStatus(outcome.target, kind, move, rng);
  return result.message ? { ...outcome, target: result.target, messages: [...outcome.messages, result.message] } : outcome;
}

function applySecondaryStages(outcome: MoveOutcome, move: BattleMove, rng: Rng): MoveOutcome {
  if (move.statChanges.length === 0) return outcome;
  const onUser = move.quality === QUALITY_RAISE_USER || move.target === SELF_TARGET;
  if (!onUser && outcome.target.currentHp === 0) return outcome;
  const changed = applyStatChanges(onUser ? outcome.user : outcome.target, move.statChanges, rng, false);
  const sides = onUser ? { user: changed.pokemon } : { target: changed.pokemon };
  return { ...outcome, ...sides, messages: [...outcome.messages, ...changed.messages] };
}

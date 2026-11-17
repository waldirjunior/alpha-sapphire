import type { BattleMove, PokemonInstance } from './battlePokemon';
import { calculateDamage, moveEffectiveness, rollCritical, rollHitCount } from './damage';
import type { DexStatChange } from './dex';
import { accuracyStageMultiplier, applyStageDelta, STAT_LABELS, statsForRomId } from './statStages';
import { statusKindForMove, tryInflictStatus, type Rng } from './statusConditions';

export interface MoveOutcome {
  user: PokemonInstance;
  target: PokemonInstance;
  messages: string[];
  flinched: boolean;
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
  const threshold = move.accuracy * accuracyStageMultiplier(user.stages.accuracy, target.stages.evasion);
  return Math.min(0.999999, Math.max(0, rng())) * 100 < threshold;
}

export function executeMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng): MoveOutcome {
  if (!rollAccuracy(user, target, move, rng)) {
    return { user, target, messages: [`${user.species.name} usou ${move.name}, mas errou!`], flinched: false };
  }
  return move.category === 'status' ? executeStatusMove(user, target, move, rng) : executeDamagingMove(user, target, move, rng);
}

function executeStatusMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng): MoveOutcome {
  const used = `${user.species.name} usou ${move.name}!`;
  if (move.quality === QUALITY_HEAL) return healUser(user, target, move, used);
  if (move.quality === QUALITY_INFLICT) return inflictFromStatusMove(user, target, move, rng, used);
  if (move.quality === QUALITY_STAGES) {
    const selfTarget = move.target === SELF_TARGET;
    const changed = applyStatChanges(selfTarget ? user : target, move.statChanges, rng, true);
    const outcome = selfTarget ? { user: changed.pokemon, target } : { user, target: changed.pokemon };
    return { ...outcome, messages: [used, ...orFailed(changed.messages)], flinched: false };
  }
  return { user, target, messages: [used, `O efeito de ${move.name} ainda não é simulado (P-010).`], flinched: false };
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

function executeDamagingMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng): MoveOutcome {
  const effectiveness = moveEffectiveness(move, target);
  if (effectiveness === 0) {
    return { user, target, messages: [`${user.species.name} usou ${move.name}, mas não afeta ${target.species.name}...`], flinched: false };
  }
  const hits = rollHitCount(move, rng);
  let defender = target;
  let total = 0;
  let crits = 0;
  for (let hit = 0; hit < hits && defender.currentHp > 0; hit += 1) {
    const critical = rollCritical(defender, move, rng);
    const dmg = calculateDamage(user, defender, move, rng, { critical });
    defender = { ...defender, currentHp: Math.max(0, defender.currentHp - dmg) };
    total += dmg;
    crits += critical ? 1 : 0;
  }
  const effNote = effectiveness > 1 ? ' (Super efetivo!)' : effectiveness < 1 ? ' (Pouco efetivo...)' : '';
  const hitNote = hits > 1 ? ` em ${hits} golpes` : '';
  const critNote = crits > 0 ? ' Acerto crítico!' : '';
  const messages = [`${user.species.name} usou ${move.name} e causou ${total} de dano${hitNote}!${effNote}${critNote}`];
  return applyAfterDamage({ user, target: defender, messages, flinched: false }, move, total, rng);
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

import type { BattleMove, PokemonInstance } from './battlePokemon';
import { calculateDamage, moveEffectiveness, rollCritical, rollHitCount } from './damage';
import { abilityImmunity, activateTypeImmunity, triggerContactAbility } from './battleAbilities';
import { triggerThresholdBerry } from './battleHeldItems';
import { applyStatChanges, inflictConfusion } from './battleMoveEffects';
import { statusKindForMove, tryInflictStatus, type Rng } from './statusConditions';
import type { BattleScreen, BattleScreenState } from './battleField';
import type { MoveExecutionContext, MoveOutcome } from './moveExecution';

const QUALITY_RAISE_USER = 7;
const SELF_TARGET = 7;
const UNREMOVABLE_HELD_ITEMS: ReadonlySet<string> = new Set(['Griseous Orb', 'Red Orb', 'Blue Orb']);

export function executeOneHitKnockout(user: PokemonInstance, target: PokemonInstance, move: BattleMove): MoveOutcome {
  const used = `${user.species.name} usou ${move.name}!`;
  if (target.ability === 'Sturdy') {
    return { user, target, messages: [used, `A habilidade Sturdy de ${target.species.name} impediu o nocaute!`], flinched: false };
  }
  const saved = saveFromLethalHit(target);
  if (saved) return { user, target: saved.pokemon, messages: [used, saved.message], flinched: false };
  return { user, target: { ...target, currentHp: 0 }, messages: [used, 'Nocaute em um golpe!'], flinched: false };
}

export function executeDamagingMove(
  user: PokemonInstance,
  target: PokemonInstance,
  move: BattleMove,
  rng: Rng,
  context: MoveExecutionContext
): MoveOutcome {
  const immune = immuneTarget(user, target, move);
  if (immune) return immune;
  const effectiveness = moveEffectiveness(move, target);
  if (effectiveness === 0) return failedEffectiveness(user, target, move);
  return damageHits(user, target, move, rng, context, effectiveness);
}

function immuneTarget(user: PokemonInstance, target: PokemonInstance, move: BattleMove): MoveOutcome | null {
  const immunity = abilityImmunity(target, move.type);
  if (!immunity) return null;
  const activated = activateTypeImmunity(target, immunity);
  return { user, target: activated.pokemon, messages: [`${user.species.name} usou ${move.name}!`, activated.message], flinched: false };
}

function failedEffectiveness(user: PokemonInstance, target: PokemonInstance, move: BattleMove): MoveOutcome {
  return { user, target, messages: [`${user.species.name} usou ${move.name}, mas não afeta ${target.species.name}...`], flinched: false };
}

function damageHits(
  user: PokemonInstance,
  target: PokemonInstance,
  move: BattleMove,
  rng: Rng,
  context: MoveExecutionContext,
  effectiveness: number
): MoveOutcome {
  const hits = rollHitCount(move, rng);
  const damageMove = move.name === 'Knock Off' && canRemoveHeldItem(target) ? { ...move, power: move.power * 1.5 } : move;
  const hit = applyHits(user, target, move, damageMove, rng, context, hits);
  const outcome = summarizeHits(user, move, hit, effectiveness, hits);
  const hpEffects = applyAfterDamage(outcome, move, hit.damage, rng);
  const withContact = addContactEffect(hpEffects, move, rng, hits, hit.damage);
  const postHit = removeKnockedOffItem(withContact, move);
  const switched = (move.name === 'U-turn' || move.name === 'Volt Switch') && hit.damage > 0
    ? { ...postHit, switchUser: true }
    : postHit;
  return move.name === 'Rapid Spin' && hit.damage > 0 ? { ...switched, fieldUpdate: { clearHazards: 'user' } } : switched;
}

interface HitSummary {
  target: PokemonInstance;
  damage: number;
  criticals: number;
  hitSubstitute: boolean;
  berryMessages: string[];
  survivalMessages: string[];
}

function applyHits(
  user: PokemonInstance,
  target: PokemonInstance,
  move: BattleMove,
  damageMove: BattleMove,
  rng: Rng,
  context: MoveExecutionContext,
  hits: number
): HitSummary {
  let defender = target;
  let damage = 0;
  let criticals = 0;
  let hitSubstitute = false;
  const berryMessages: string[] = [];
  const survivalMessages: string[] = [];
  for (let hit = 0; hit < hits && defender.currentHp > 0; hit += 1) {
    const hpBeforeHit = defender.currentHp;
    const critical = rollCritical(defender, move, rng, user);
    const damageForHit = calculateDamage(user, defender, damageMove, rng, damageOptions(move, context, critical));
    const result = applyDamageHit(defender, damageForHit);
    defender = result.pokemon;
    hitSubstitute ||= result.hitSubstitute;
    if (result.message) survivalMessages.push(result.message);
    const berry = defender.currentHp < hpBeforeHit ? triggerThresholdBerry(defender) : null;
    if (berry) defender = berry.pokemon;
    if (berry?.message) berryMessages.push(berry.message);
    damage += damageForHit;
    criticals += critical ? 1 : 0;
  }
  return { target: defender, damage, criticals, hitSubstitute, berryMessages, survivalMessages };
}

function summarizeHits(
  user: PokemonInstance,
  move: BattleMove,
  hit: HitSummary,
  effectiveness: number,
  hits: number
): MoveOutcome {
  const effNote = effectiveness > 1 ? ' (Super efetivo!)' : effectiveness < 1 ? ' (Pouco efetivo...)' : '';
  const hitNote = hits > 1 ? ` em ${hits} golpes` : '';
  const critNote = hit.criticals > 0 ? ' Acerto crítico!' : '';
  const messages = [
    `${user.species.name} usou ${move.name} e causou ${hit.damage} de dano${hitNote}!${effNote}${critNote}`,
    ...hit.survivalMessages,
    ...hit.berryMessages,
  ];
  return { user, target: hit.target, messages, flinched: false, hitSubstitute: hit.hitSubstitute };
}

function canRemoveHeldItem(pokemon: PokemonInstance): boolean {
  const item = pokemon.heldItem;
  if (!item || pokemon.ability === 'Sticky Hold' || UNREMOVABLE_HELD_ITEMS.has(item) || item.endsWith(' Mail')) return false;
  return !item.endsWith('ite') || item === 'Eviolite';
}

function removeKnockedOffItem(outcome: MoveOutcome, move: BattleMove): MoveOutcome {
  if (move.name !== 'Knock Off' || outcome.hitSubstitute || !canRemoveHeldItem(outcome.target)) return outcome;
  const item = outcome.target.heldItem;
  if (!item) return outcome;
  return {
    ...outcome,
    target: { ...outcome.target, heldItem: null },
    messages: [...outcome.messages, `${outcome.target.species.name} perdeu ${item}!`],
  };
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

function applyDamageHit(target: PokemonInstance, damage: number): { pokemon: PokemonInstance; hitSubstitute: boolean; message: string | null } {
  const substituteHp = target.volatile.substituteHp ?? 0;
  if (substituteHp > 0) {
    return { pokemon: { ...target, volatile: { ...target.volatile, substituteHp: Math.max(0, substituteHp - damage) } }, hitSubstitute: true, message: null };
  }
  const hpAfterHit = Math.max(0, target.currentHp - damage);
  const saved = hpAfterHit === 0 ? saveFromLethalHit(target) : null;
  return { pokemon: saved?.pokemon ?? { ...target, currentHp: hpAfterHit }, hitSubstitute: false, message: saved?.message ?? null };
}

function saveFromLethalHit(target: PokemonInstance): { pokemon: PokemonInstance; message: string } | null {
  if (target.currentHp !== target.maxHp) return null;
  if (target.ability === 'Sturdy') {
    return { pokemon: { ...target, currentHp: 1 }, message: `A habilidade Sturdy de ${target.species.name} impediu o nocaute!` };
  }
  if (target.heldItem === 'Focus Sash') {
    return { pokemon: { ...target, currentHp: 1, heldItem: null }, message: `${target.species.name} aguentou o golpe com Focus Sash!` };
  }
  return null;
}

function addContactEffect(outcome: MoveOutcome, move: BattleMove, rng: Rng, hits: number, damage: number): MoveOutcome {
  let attacker = outcome.user;
  let message: string | null = null;
  if (move.contact && damage > 0) {
    for (let hit = 0; hit < hits && outcome.target.currentHp > 0 && attacker.status === null; hit += 1) {
      const result = triggerContactAbility(outcome.target, attacker, move, rng);
      attacker = result.attacker;
      message = result.message ?? message;
    }
  }
  return { ...outcome, user: attacker, messages: message ? [...outcome.messages, message] : outcome.messages };
}

function applyAfterDamage(outcome: MoveOutcome, move: BattleMove, damage: number, rng: Rng): MoveOutcome {
  const withHp = applyHpSideEffects(outcome, move, damage);
  if (withHp.hitSubstitute) return { ...withHp, flinched: false };
  const withStatus = applySecondaryStatus(withHp, move, rng);
  const withStages = applySecondaryStages(withStatus, move, rng);
  const flinched = withStages.target.currentHp > 0 && move.flinchPercent > 0 && rng() * 100 < move.flinchPercent;
  return { ...withStages, flinched };
}

function applyHpSideEffects(outcome: MoveOutcome, move: BattleMove, damage: number): MoveOutcome {
  const { user } = outcome;
  let delta = 0;
  if (move.recoilPercent !== 0 && !(user.ability === 'Rock Head' && move.recoilPercent < 0)) {
    delta += Math.sign(move.recoilPercent) * Math.max(1, Math.floor((damage * Math.abs(move.recoilPercent)) / 100));
  }
  if (move.healPercent < 0) delta -= Math.max(1, Math.floor((user.maxHp * -move.healPercent) / 100));
  if (user.heldItem === 'Life Orb' && damage > 0) delta -= Math.max(1, Math.floor(user.maxHp / 10));
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

import type { BattleMove, BattleVolatileState, PokemonInstance } from './battlePokemon';
import type { StageStat } from './statStages';
import { applyStageDelta } from './statStages';
import { rollInRange, type Rng } from './statusConditions';
import type { MoveExecutionContext, MoveOutcome } from './moveExecution';

type MoveExecutor = (
  user: PokemonInstance,
  target: PokemonInstance,
  move: BattleMove,
  rng: Rng,
  context: MoveExecutionContext
) => MoveOutcome;

export function executeQuality13Move(
  user: PokemonInstance,
  target: PokemonInstance,
  move: BattleMove,
  rng: Rng,
  used: string,
  context: MoveExecutionContext,
  execute: MoveExecutor
): MoveOutcome | null {
  if (move.name === 'Splash') return noEffectFlavor(user, target, used);
  if (move.name === 'Celebrate' || move.name === 'Hold Hands' || move.name === 'Happy Hour') return flavorMove(user, target, move, used);
  if (move.name === 'Focus Energy') return setVolatile(user, target, used, 'focusEnergy');
  if (move.name === 'Endure') return protect(user, target, rng, used, 'endure');
  if (move.name === 'Protect' || move.name === 'Detect') return protect(user, target, rng, used, 'all');
  if (move.name === 'Spiky Shield') return protect(user, target, rng, used, 'spiky');
  if (move.name === 'King’s Shield') return protect(user, target, rng, used, 'kings');
  if (move.name === 'Bestow') return bestow(user, target, used);
  if (move.name === 'Trick' || move.name === 'Switcheroo') return swapItems(user, target, used);
  if (move.name === 'Rest') return rest(user, target, used);
  if (move.name === 'Sleep Talk') return sleepTalk(user, target, move, rng, used, context, execute);
  if (move.name === 'Refresh') return refresh(user, target, used);
  if (move.name === 'Heal Bell' || move.name === 'Aromatherapy') return cureParty(user, target, used);
  if (move.name === 'Belly Drum') return bellyDrum(user, target, used);
  if (move.name === 'Shell Smash') return shellSmash(user, target, used);
  if (move.name === 'Curse') return curse(user, target, used);
  if (move.name === 'Pain Split') return painSplit(user, target, used);
  if (move.name === 'Psych Up') return psychUp(user, target, used);
  if (move.name === 'Power Trick') return powerTrick(user, target, used);
  if (move.name === 'Power Swap') return swapStages(user, target, used, ['atk', 'spa']);
  if (move.name === 'Guard Swap') return swapStages(user, target, used, ['def', 'spd']);
  if (move.name === 'Heart Swap') return swapStages(user, target, used, STAGE_STATS);
  if (move.name === 'Topsy-Turvy') return topsyTurvy(user, target, used);
  if (move.name === 'Aqua Ring') return aquaRing(user, target, used);
  if (move.name === 'Magnet Rise') return magnetRise(user, target, used);
  if (move.name === 'Memento') return memento(user, target, used);
  if (move.name === 'Destiny Bond') return setVolatile(user, target, used, 'destinyBond');
  if (move.name === 'Mind Reader' || move.name === 'Lock-On') return setVolatile(user, target, used, 'lockedOn');
  if (move.name === 'Spite') return spite(user, target, used);
  if (move.name === 'Teleport') return null;
  return null;
}

const STAGE_STATS: readonly StageStat[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];

function noEffectFlavor(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
}

function flavorMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, used: string): MoveOutcome {
  return { user, target, messages: [used, `${user.species.name} ${move.name === 'Happy Hour' ? 'comemorou!' : 'ficou feliz!'}`], flinched: false };
}

function setVolatile(
  user: PokemonInstance,
  target: PokemonInstance,
  used: string,
  key: 'focusEnergy' | 'destinyBond' | 'lockedOn'
): MoveOutcome {
  return { user: { ...user, volatile: { ...user.volatile, [key]: true } }, target, messages: [used], flinched: false };
}

function protect(
  user: PokemonInstance,
  target: PokemonInstance,
  rng: Rng,
  used: string,
  kind: 'all' | 'endure' | 'spiky' | 'kings'
): MoveOutcome {
  const chance = 1 / 2 ** user.volatile.protectStreak;
  const roll = Math.min(0.999999, Math.max(0, rng()));
  if (roll >= chance) {
    const volatile = { ...user.volatile, protectStreak: 0, protecting: false, protectionKind: null, enduring: false };
    return { user: { ...user, volatile }, target, messages: [used, `${user.species.name} não conseguiu se proteger!`], flinched: false };
  }
  const protectionKind: BattleVolatileState['protectionKind'] = kind === 'all' ? 'all' : kind === 'endure' ? null : kind;
  const volatile = {
    ...user.volatile,
    protectStreak: user.volatile.protectStreak + 1,
    protecting: kind !== 'endure',
    protectionKind,
    enduring: kind === 'endure',
  };
  const message = kind === 'endure' ? `${user.species.name} aguentará os golpes!` : `${user.species.name} se protegeu!`;
  return { user: { ...user, volatile }, target, messages: [used, message], flinched: false };
}

function bestow(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  if (target.heldItem !== null || !removableItem(user)) return noEffectFlavor(user, target, used);
  return {
    user: { ...user, heldItem: null },
    target: { ...target, heldItem: user.heldItem },
    messages: [used, `${user.species.name} passou ${user.heldItem} para ${target.species.name}!`],
    flinched: false,
  };
}

function removableItem(user: PokemonInstance): boolean {
  const item = user.heldItem;
  if (!item || user.ability === 'Sticky Hold') return false;
  if (['Griseous Orb', 'Red Orb', 'Blue Orb'].includes(item) || item.endsWith(' Mail')) return false;
  return !item.endsWith('ite') || item === 'Eviolite';
}

function swapItems(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  if (user.heldItem === null && target.heldItem === null) return noEffectFlavor(user, target, used);
  return {
    user: { ...user, heldItem: target.heldItem },
    target: { ...target, heldItem: user.heldItem },
    messages: [used, `${user.species.name} trocou os itens segurados!`],
    flinched: false,
  };
}

function rest(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  if (user.currentHp === user.maxHp) return noEffectFlavor(user, target, used);
  const healed = { ...user, currentHp: user.maxHp, status: { kind: 'sleep' as const, counter: 2 } };
  return { user: healed, target, messages: [used, `${user.species.name} recuperou HP e adormeceu!`], flinched: false };
}

function sleepTalk(
  user: PokemonInstance,
  target: PokemonInstance,
  move: BattleMove,
  rng: Rng,
  used: string,
  context: MoveExecutionContext,
  execute: MoveExecutor
): MoveOutcome {
  const choices = user.moves.filter((slot) => slot.id !== move.id && slot.currentPp > 0
    && !((user.volatile.disableTurns ?? 0) > 0 && user.volatile.disableMoveId === slot.id));
  if (user.status?.kind !== 'sleep' || choices.length === 0) return noEffectFlavor(user, target, used);
  const selected = choices[rollInRange(0, choices.length - 1, rng)];
  if (!selected) return noEffectFlavor(user, target, used);
  const result = execute(user, target, selected, rng, context);
  return { ...result, messages: [used, `${user.species.name} usou ${selected.name} por Sleep Talk!`, ...result.messages.slice(1)] };
}

function refresh(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const curable = ['burn', 'paralysis', 'poison', 'toxic'].includes(user.status?.kind ?? '');
  if (!curable) return noEffectFlavor(user, target, used);
  return { user: { ...user, status: null }, target, messages: [used, `${user.species.name} curou sua condição de status!`], flinched: false };
}

function cureParty(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  return {
    user: { ...user, status: null },
    target,
    messages: [used, `${user.species.name} curou as condições de status do time!`],
    flinched: false,
    curePartyStatus: true,
  };
}

function bellyDrum(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const cost = Math.floor(user.maxHp / 2);
  if (user.currentHp <= cost || user.stages.atk >= 6) return noEffectFlavor(user, target, used);
  const stages = { ...user.stages, atk: 6 };
  return {
    user: { ...user, currentHp: user.currentHp - cost, stages },
    target,
    messages: [used, `${user.species.name} maximizou o Ataque!`],
    flinched: false,
  };
}

function shellSmash(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  let stages = user.stages;
  stages = applyStageDelta(stages, 'def', -1).stages;
  stages = applyStageDelta(stages, 'spd', -1).stages;
  stages = applyStageDelta(stages, 'atk', 2).stages;
  stages = applyStageDelta(stages, 'spa', 2).stages;
  stages = applyStageDelta(stages, 'spe', 2).stages;
  return { user: { ...user, stages }, target, messages: [used, `${user.species.name} quebrou sua casca e aumentou o poder!`], flinched: false };
}

function curse(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  if (!user.species.types.includes('ghost')) {
    const stages = applyStageDelta(applyStageDelta(applyStageDelta(user.stages, 'spe', -1).stages, 'atk', 1).stages, 'def', 1).stages;
    return { user: { ...user, stages }, target, messages: [used, `${user.species.name} ficou amaldiçoado e alterou seus atributos!`], flinched: false };
  }
  const cost = Math.floor(user.maxHp / 2);
  if (target.volatile.cursed) return noEffectFlavor(user, target, used);
  return {
    user: { ...user, currentHp: Math.max(0, user.currentHp - cost) },
    target: { ...target, volatile: { ...target.volatile, cursed: true } },
    messages: [used, `${user.species.name} sacrificou HP para amaldiçoar ${target.species.name}!`],
    flinched: false,
  };
}

function painSplit(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const average = Math.max(1, Math.floor((user.currentHp + target.currentHp) / 2));
  return {
    user: { ...user, currentHp: Math.min(user.maxHp, average) },
    target: { ...target, currentHp: Math.min(target.maxHp, average) },
    messages: [used, 'Os combatentes compartilharam seus HP!'],
    flinched: false,
  };
}

function psychUp(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  return { user: { ...user, stages: target.stages }, target, messages: [used, `${user.species.name} copiou as mudanças de atributo!`], flinched: false };
}

function powerTrick(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  return {
    user: { ...user, attack: user.defense, defense: user.attack, volatile: { ...user.volatile, powerTrick: !user.volatile.powerTrick } },
    target,
    messages: [used, `${user.species.name} trocou Ataque e Defesa!`],
    flinched: false,
  };
}

function swapStages(user: PokemonInstance, target: PokemonInstance, used: string, stats: readonly StageStat[]): MoveOutcome {
  const userStages = { ...user.stages };
  const targetStages = { ...target.stages };
  for (const stat of stats) {
    userStages[stat] = target.stages[stat];
    targetStages[stat] = user.stages[stat];
  }
  return { user: { ...user, stages: userStages }, target: { ...target, stages: targetStages }, messages: [used, 'As mudanças de atributo foram trocadas!'], flinched: false };
}

function topsyTurvy(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const stages = {
    atk: -target.stages.atk,
    def: -target.stages.def,
    spa: target.stages.spa === 0 ? 0 : -target.stages.spa,
    spd: -target.stages.spd,
    spe: -target.stages.spe,
    accuracy: -target.stages.accuracy,
    evasion: -target.stages.evasion,
  };
  return { user, target: { ...target, stages }, messages: [used, 'As mudanças de atributo foram invertidas!'], flinched: false };
}

function aquaRing(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  if (user.volatile.aquaRing) return noEffectFlavor(user, target, used);
  return { user: { ...user, volatile: { ...user.volatile, aquaRing: true } }, target, messages: [used, `${user.species.name} foi envolvido por um véu de água!`], flinched: false };
}

function magnetRise(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  if ((user.volatile.magnetRiseTurns ?? 0) > 0) return noEffectFlavor(user, target, used);
  return { user: { ...user, volatile: { ...user.volatile, magnetRiseTurns: 5 } }, target, messages: [used, `${user.species.name} levitou magneticamente!`], flinched: false };
}

function memento(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const stages = applyStageDelta(applyStageDelta(target.stages, 'atk', -2).stages, 'spa', -2).stages;
  return {
    user: { ...user, currentHp: 0 },
    target: { ...target, stages },
    messages: [used, `${user.species.name} desmaiou após reduzir Ataque e Ataque Especial do alvo!`],
    flinched: false,
  };
}

function spite(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const moveSlot = target.moves.findIndex((slot) => slot.id === target.lastMoveId && slot.currentPp > 0);
  if (target.lastMoveId === null || target.lastMoveId === undefined || moveSlot < 0) return noEffectFlavor(user, target, used);
  const moves = target.moves.map((slot, index) => index === moveSlot
    ? { ...slot, currentPp: Math.max(0, slot.currentPp - 4) }
    : slot);
  const spent = (target.moves[moveSlot]?.currentPp ?? 0) - (moves[moveSlot]?.currentPp ?? 0);
  return { user, target: { ...target, moves }, messages: [used, `O golpe ${target.moves[moveSlot]?.name} perdeu ${spent} PP!`], flinched: false };
}

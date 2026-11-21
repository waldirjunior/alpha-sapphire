import { fromTables } from './battleTables';
import { getMoveById, getMoveByName } from './dex';
import type { BattleMove, PokemonInstance } from './battlePokemon';
import { overridePokemonTypes, pokemonTypes, toBattleMove } from './battlePokemon';
import { applyStageDelta, type StageStat } from './statStages';
import { rollInRange, tryInflictStatus, type Rng } from './statusConditions';
import { ELEMENTAL_TYPES, getTypeMultiplier, type ElementalType } from './typeChart';
import type { MoveExecutionContext, MoveOutcome } from './moveExecution';

type MoveExecutor = (user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng, context: MoveExecutionContext) => MoveOutcome;

const STATS: readonly StageStat[] = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
const METRONOME_BANNED = new Set(['Assist', 'Baneful Bunker', 'Beak Blast', 'Belch', 'Bestow', 'Bounce', 'Celebrate', 'Chatter', 'Circle Throw', 'Copycat', 'Counter', 'Covet', 'Destiny Bond', 'Detect', 'Dig', 'Dive', 'Dragon Tail', 'Endure', 'Feint', 'Fly', 'Focus Punch', 'Follow Me', 'Helping Hand', 'Hold Hands', 'King’s Shield', 'Mat Block', 'Me First', 'Metronome', 'Mimic', 'Mirror Coat', 'Mirror Move', 'Nature Power', 'Phantom Force', 'Protect', 'Quash', 'Rage Powder', 'Roar', 'Shadow Force', 'Sketch', 'Sky Drop', 'Sleep Talk', 'Snatch', 'Spiky Shield', 'Spotlight', 'Struggle', 'Switcheroo', 'Thief', 'Transform', 'Trick', 'V-create', 'Whirlwind']);
const ASSIST_BANNED = new Set(['Assist', 'Chatter', 'Copycat', 'Counter', 'Covet', 'Destiny Bond', 'Detect', 'Endure', 'Feint', 'Focus Punch', 'Follow Me', 'Helping Hand', 'Hold Hands', 'King’s Shield', 'Me First', 'Metronome', 'Mimic', 'Mirror Coat', 'Mirror Move', 'Nature Power', 'Protect', 'Rage Powder', 'Sketch', 'Sleep Talk', 'Snatch', 'Spiky Shield', 'Struggle', 'Switcheroo', 'Thief', 'Transform', 'Trick', 'V-create']);
const ABILITY_SWAP_BLOCKED = new Set(['Multitype', 'Stance Change', 'Wonder Guard', 'Zen Mode']);

export function executeAdvancedQuality13Move(
  user: PokemonInstance,
  target: PokemonInstance,
  move: BattleMove,
  rng: Rng,
  used: string,
  context: MoveExecutionContext,
  execute: MoveExecutor,
): MoveOutcome | null {
  if (move.name === 'Wish') return scheduleWish(user, target, used);
  if (move.name === 'Future Sight' || move.name === 'Doom Desire') return scheduleAttack(user, target, move, used, context);
  if (move.name === 'Healing Wish' || move.name === 'Lunar Dance') return healingWish(user, target, move, used);
  if (move.name === 'Power Split' || move.name === 'Guard Split') return splitStats(user, target, move, used);
  if (move.name === 'Stockpile') return stockpile(user, target, used);
  if (move.name === 'Acupressure') return acupressure(user, target, rng, used);
  if (move.name === 'Flower Shield') return flowerShield(user, target, used);
  if (move.name === 'Gastro Acid' || move.name === 'Worry Seed' || move.name === 'Simple Beam' || move.name === 'Entrainment' || move.name === 'Role Play' || move.name === 'Skill Swap') {
    return abilityMove(user, target, move, used);
  }
  if (move.name === 'Soak' || move.name === 'Reflect Type' || move.name === 'Trick-or-Treat' || move.name === 'Forest’s Curse'
    || move.name === 'Conversion' || move.name === 'Conversion 2' || move.name === 'Camouflage') {
    return typeMove(user, target, move, rng, used, context);
  }
  if (move.name === 'Electrify') return electrify(user, target, used, context);
  if (move.name === 'Powder') return powder(user, target, used);
  if (move.name === 'Recycle') return recycle(user, target, used);
  if (move.name === 'Imprison') return imprison(user, target, used);
  if (move.name === 'Grudge') return setTemporaryFlag(user, target, used, 'grudge');
  if (move.name === 'Snatch') return setTemporaryFlag(user, target, used, 'snatch');
  if (move.name === 'Magic Coat') return setTemporaryFlag(user, target, used, 'magicCoat');
  if (move.name === 'Psycho Shift') return psychoShift(user, target, move, rng, used);
  if (move.name === 'Copycat' || move.name === 'Mirror Move') return copyMove(user, target, move, rng, used, context, execute);
  if (move.name === 'Mimic' || move.name === 'Sketch') return copyMoveIntoSlot(user, target, move, used);
  if (move.name === 'Metronome') return metronome(user, target, move, rng, used, context, execute);
  if (move.name === 'Assist') return assist(user, target, move, rng, used, context, execute);
  if (move.name === 'Nature Power') return naturePower(user, target, move, rng, used, context, execute);
  if (move.name === 'Transform') return transform(user, target, used);
  if (['Follow Me', 'Rage Powder', 'Helping Hand', 'After You', 'Ally Switch', 'Quash'].includes(move.name)) {
    return singlesSupport(user, target, move, used);
  }
  return null;
}

function scheduleWish(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  return { user, target, messages: [used, `${user.species.name} deseja recuperar HP no fim do próximo turno!`], flinched: false,
    scheduleWish: { healAmount: Math.floor(user.maxHp / 2) } };
}

function scheduleAttack(user: PokemonInstance, target: PokemonInstance, move: BattleMove, used: string, context: MoveExecutionContext): MoveOutcome {
  if (context.delayedAttackPending) return failed(user, target, used);
  return { user, target, messages: [used, `${move.name} foi lançado para atingir o alvo depois!`], flinched: false,
    scheduleDelayedAttack: { move, source: user } };
}

function healingWish(user: PokemonInstance, target: PokemonInstance, move: BattleMove, used: string): MoveOutcome {
  return { user: { ...user, currentHp: 0 }, target, messages: [used, `${user.species.name} sacrificou-se para restaurar o próximo aliado!`], flinched: false,
    schedulePartyRestore: { fullPp: move.name === 'Lunar Dance' } };
}

function splitStats(user: PokemonInstance, target: PokemonInstance, move: BattleMove, used: string): MoveOutcome {
  const attack = move.name === 'Power Split';
  const userStat = attack ? user.attack : user.defense;
  const targetStat = attack ? target.attack : target.defense;
  const userSpecial = attack ? user.spAtk : user.spDef;
  const targetSpecial = attack ? target.spAtk : target.spDef;
  const average = Math.floor((userStat + targetStat) / 2);
  const specialAverage = Math.floor((userSpecial + targetSpecial) / 2);
  const userNext = attack ? { ...user, attack: average, spAtk: specialAverage } : { ...user, defense: average, spDef: specialAverage };
  const targetNext = attack ? { ...target, attack: average, spAtk: specialAverage } : { ...target, defense: average, spDef: specialAverage };
  return { user: userNext, target: targetNext, messages: [used, `${move.name} equilibrou os atributos dos combatentes!`], flinched: false };
}

function stockpile(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const count = user.volatile.stockpileCount ?? 0;
  if (count >= 3) return failed(user, target, used);
  const def = applyStage(user, 'def', 1);
  const spd = applyStage({ ...user, stages: def.stages }, 'spd', 1);
  const volatile = { ...user.volatile, stockpileCount: count + 1,
    stockpileDefenseBoost: (user.volatile.stockpileDefenseBoost ?? 0) + def.applied,
    stockpileSpDefenseBoost: (user.volatile.stockpileSpDefenseBoost ?? 0) + spd.applied };
  return { user: { ...user, stages: spd.stages, volatile }, target, messages: [used, `${user.species.name} acumulou energia (${count + 1})!`], flinched: false };
}

function acupressure(user: PokemonInstance, target: PokemonInstance, rng: Rng, used: string): MoveOutcome {
  const available = STATS.filter((stat) => user.stages[stat] < 6);
  if (available.length === 0) return failed(user, target, used);
  const stat = available[rollInRange(0, available.length - 1, rng)];
  if (!stat) return failed(user, target, used);
  const stages = applyStage(user, stat, 2).stages;
  return { user: { ...user, stages }, target, messages: [used, `${user.species.name} aumentou ${stat} com Acupressure!`], flinched: false };
}

function flowerShield(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const userGrass = pokemonTypes(user).includes('grass');
  const targetGrass = target.currentHp > 0 && pokemonTypes(target).includes('grass');
  if (!userGrass && !targetGrass) return failed(user, target, used);
  return { user: userGrass ? raiseDefense(user) : user, target: targetGrass ? raiseDefense(target) : target,
    messages: [used, 'A Defesa dos Pokémon de tipo Grass aumentou!'], flinched: false };
}

function raiseDefense(pokemon: PokemonInstance): PokemonInstance {
  return { ...pokemon, stages: applyStage(pokemon, 'def', 1).stages };
}

function applyStage(pokemon: PokemonInstance, stat: StageStat, amount: number): { stages: PokemonInstance['stages']; applied: number } {
  return applyStageDelta(pokemon.stages, stat, pokemon.ability === 'Simple' ? amount * 2 : amount);
}

function abilityMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, used: string): MoveOutcome {
  if (target.currentHp === 0) return failed(user, target, used);
  if (move.name === 'Gastro Acid') {
    if (target.abilitySuppressed || !target.ability) return failed(user, target, used);
    return { user, target: { ...target, originalAbility: target.originalAbility ?? target.ability, ability: '', abilitySuppressed: true }, messages: [used, `${target.species.name} teve sua habilidade suprimida!`], flinched: false };
  }
  if (move.name === 'Worry Seed') return replaceAbility(user, target, 'Insomnia', used, true);
  if (move.name === 'Simple Beam') return replaceAbility(user, target, 'Simple', used, false);
  if (move.name === 'Entrainment') {
    if (user.abilitySuppressed || !user.ability || user.ability === target.ability) return failed(user, target, used);
    return replaceAbility(user, target, user.ability, used, false);
  }
  if (move.name === 'Role Play') {
    if (target.abilitySuppressed || !target.ability || target.ability === user.ability) return failed(user, target, used);
    return { user: changeAbility(user, target.ability), target, messages: [used, `${user.species.name} copiou ${target.ability}!`], flinched: false };
  }
  if (move.name === 'Skill Swap') {
    if (!user.ability || !target.ability || user.ability === target.ability || ABILITY_SWAP_BLOCKED.has(user.ability) || ABILITY_SWAP_BLOCKED.has(target.ability)) return failed(user, target, used);
    return { user: changeAbility(user, target.ability), target: changeAbility(target, user.ability), messages: [used, 'As habilidades foram trocadas!'], flinched: false };
  }
  return failed(user, target, used);
}

function replaceAbility(user: PokemonInstance, target: PokemonInstance, ability: string, used: string, wakes: boolean): MoveOutcome {
  if (target.ability === ability || ABILITY_SWAP_BLOCKED.has(target.ability)) return failed(user, target, used);
  const changed = changeAbility(target, ability);
  const nextTarget = wakes && changed.status?.kind === 'sleep' ? { ...changed, status: null } : changed;
  return { user, target: nextTarget, messages: [used, `${target.species.name} agora tem ${ability}!`], flinched: false };
}

function changeAbility(pokemon: PokemonInstance, ability: string): PokemonInstance {
  return { ...pokemon, originalAbility: pokemon.originalAbility ?? pokemon.ability, ability, abilitySuppressed: false };
}

function typeMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng, used: string, context: MoveExecutionContext): MoveOutcome {
  if (move.name === 'Soak') return setTargetTypes(user, target, ['water'], used);
  if (move.name === 'Reflect Type') return setUserTypes(user, target, [...pokemonTypes(target)], used);
  if (move.name === 'Trick-or-Treat') return addType(user, target, 'ghost', used);
  if (move.name === 'Forest’s Curse') return addType(user, target, 'grass', used);
  if (move.name === 'Conversion') {
    const type = user.moves[0]?.type;
    return type ? setUserTypes(user, target, [type], used) : failed(user, target, used);
  }
  if (move.name === 'Conversion 2') return conversionTwo(user, target, rng, used);
  const biomeTypes: Readonly<Record<NonNullable<MoveExecutionContext['biome']>, ElementalType>> = {
    grass: 'grass', water: 'water', cave: 'rock', gym: 'normal', normal: 'normal',
  };
  const type = biomeTypes[context.biome ?? 'normal'];
  return setUserTypes(user, target, [type], used);
}

function setUserTypes(user: PokemonInstance, target: PokemonInstance, types: readonly ElementalType[], used: string): MoveOutcome {
  const current = pokemonTypes(user);
  if (sameTypes(current, types)) return failed(user, target, used);
  return { user: overridePokemonTypes(user, types), target, messages: [used, `${user.species.name} mudou de tipo!`], flinched: false };
}

function setTargetTypes(user: PokemonInstance, target: PokemonInstance, types: readonly ElementalType[], used: string): MoveOutcome {
  const current = pokemonTypes(target);
  if (sameTypes(current, types)) return failed(user, target, used);
  return { user, target: overridePokemonTypes(target, types), messages: [used, `${target.species.name} mudou de tipo!`], flinched: false };
}

function addType(user: PokemonInstance, target: PokemonInstance, type: ElementalType, used: string): MoveOutcome {
  const types = pokemonTypes(target);
  if (types.includes(type) || types.length >= 3) return failed(user, target, used);
  return { user, target: overridePokemonTypes(target, [...types, type]), messages: [used, `${target.species.name} também é do tipo ${type}!`], flinched: false };
}

function conversionTwo(user: PokemonInstance, target: PokemonInstance, rng: Rng, used: string): MoveOutcome {
  const lastMoveId = user.lastHitByMoveId;
  if (lastMoveId === undefined || lastMoveId === null) return failed(user, target, used);
  const lastMove = getMoveById(lastMoveId);
  const choices = ELEMENTAL_TYPES.filter((type) => getTypeMultiplier(lastMove.type, type) <= 0.5);
  if (choices.length === 0) return failed(user, target, used);
  const type = choices[rollInRange(0, choices.length - 1, rng)];
  return type ? setUserTypes(user, target, [type], used) : failed(user, target, used);
}

function sameTypes(a: readonly ElementalType[], b: readonly ElementalType[]): boolean {
  return a.length === b.length && a.every((type, index) => type === b[index]);
}

function electrify(user: PokemonInstance, target: PokemonInstance, used: string, context: MoveExecutionContext): MoveOutcome {
  if (context.targetHasMoved || context.targetChosenMoveId === undefined || context.targetChosenMoveId === null) return failed(user, target, used);
  return { user, target: { ...target, volatile: { ...target.volatile, electrifiedMoveId: context.targetChosenMoveId } },
    messages: [used, `${target.species.name} foi eletrificado!`], flinched: false };
}

function powder(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  if (target.currentHp === 0 || target.volatile.powderTurns && target.volatile.powderTurns > 0) return failed(user, target, used);
  return { user, target: { ...target, volatile: { ...target.volatile, powderTurns: 1 } }, messages: [used, `${target.species.name} foi coberto por Powder!`], flinched: false };
}

function recycle(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  if (user.heldItem !== null || !user.consumedItem) return failed(user, target, used);
  return { user: { ...user, heldItem: user.consumedItem, consumedItem: null }, target, messages: [used, `${user.species.name} recuperou ${user.heldItem ?? user.consumedItem}!`], flinched: false };
}

function imprison(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const ids = [...new Set(user.moves.map((slot) => slot.id))];
  if (user.volatile.imprisonedMoves?.length) return failed(user, target, used);
  return { user: { ...user, volatile: { ...user.volatile, imprisonedMoves: ids } }, target, messages: [used, `${user.species.name} selou os golpes conhecidos!`], flinched: false };
}

function setTemporaryFlag(user: PokemonInstance, target: PokemonInstance, used: string, key: 'grudge' | 'snatch' | 'magicCoat'): MoveOutcome {
  if (user.volatile[key]) return failed(user, target, used);
  return { user: { ...user, volatile: { ...user.volatile, [key]: true } }, target, messages: [used, `${user.species.name} preparou ${key}!`], flinched: false };
}

function psychoShift(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng, used: string): MoveOutcome {
  if (!user.status || target.currentHp === 0) return failed(user, target, used);
  if (statusAbilityImmunity(target, user.status.kind)) return failed(user, target, used);
  const shifted = tryInflictStatus(target, user.status.kind, move, rng);
  if (!shifted.message) return failed(user, target, used);
  return { user: { ...user, status: null }, target: shifted.target, messages: [used, shifted.message, `${user.species.name} curou seu status!`], flinched: false };
}

function statusAbilityImmunity(target: PokemonInstance, status: NonNullable<PokemonInstance['status']>['kind']): boolean {
  const immunities: Readonly<Record<NonNullable<PokemonInstance['status']>['kind'], readonly string[]>> = {
    paralysis: ['Limber'], sleep: ['Insomnia', 'Vital Spirit', 'Sweet Veil'], freeze: ['Magma Armor'],
    burn: ['Water Veil'], poison: ['Immunity'], toxic: ['Immunity'],
  };
  return immunities[status].includes(target.ability);
}

function copyMove(user: PokemonInstance, target: PokemonInstance, move: BattleMove, rng: Rng, used: string, context: MoveExecutionContext, execute: MoveExecutor): MoveOutcome {
  const moveId = move.name === 'Copycat' ? context.lastMoveUsedId : user.lastHitByMoveId;
  if (moveId === undefined || moveId === null || moveId === move.id) return failed(user, target, used);
  const copied = getMoveById(moveId);
  if (['Copycat', 'Mirror Move', 'Metronome', 'Sketch', 'Struggle'].includes(copied.name)) return failed(user, target, used);
  const result = execute(user, target, toBattleMove(copied), rng, context);
  return { ...result, copiedMoveId: copied.id, messages: [used, `${user.species.name} copiou ${copied.name}!`, ...result.messages.slice(1)] };
}

function copyMoveIntoSlot(user: PokemonInstance, target: PokemonInstance, move: BattleMove, used: string): MoveOutcome {
  const moveId = target.lastMoveId;
  if (moveId === undefined || moveId === null || moveId === move.id) return failed(user, target, used);
  const copiedMove = getMoveById(moveId);
  if (['Mimic', 'Sketch', 'Struggle'].includes(copiedMove.name)) return failed(user, target, used);
  const originalMoves = user.transformedMoves ?? user.moves;
  const replacement = { ...toBattleMove(copiedMove), currentPp: move.name === 'Sketch' ? 1 : 5, maxPp: move.name === 'Sketch' ? 1 : 5 };
  const moves = user.moves.map((slot) => slot.id === move.id ? replacement : slot);
  return { user: { ...user, moves, transformedMoves: originalMoves }, target,
    messages: [used, `${user.species.name} aprendeu ${copiedMove.name}!`], flinched: false };
}

function metronome(user: PokemonInstance, target: PokemonInstance, _move: BattleMove, rng: Rng, used: string, context: MoveExecutionContext, execute: MoveExecutor): MoveOutcome {
  const choices = allMetronomeMoveIds().filter((id) => !METRONOME_BANNED.has(getMoveById(id).name));
  return executeRandomCopy(user, target, rng, used, context, execute, choices);
}

function allMetronomeMoveIds(): number[] {
  return fromTables((tables) => tables.moves.filter((entry) => entry.id > 0 && !METRONOME_BANNED.has(entry.name)).map((entry) => entry.id))();
}

function assist(user: PokemonInstance, target: PokemonInstance, _move: BattleMove, rng: Rng, used: string, context: MoveExecutionContext, execute: MoveExecutor): MoveOutcome {
  const party = context.userParty ?? [];
  const choices = party.flatMap((member, index) => index === (context.userActiveIndex ?? -1) ? [] : member.moves
    .filter((slot) => !ASSIST_BANNED.has(slot.name)).map((slot) => slot.id));
  return executeRandomCopy(user, target, rng, used, context, execute, choices);
}

function naturePower(user: PokemonInstance, target: PokemonInstance, _move: BattleMove, rng: Rng, used: string, context: MoveExecutionContext, execute: MoveExecutor): MoveOutcome {
  const selected = context.biome === 'grass' ? 'Energy Ball' : context.biome === 'water' ? 'Hydro Pump' : context.biome === 'cave' ? 'Power Gem' : 'Tri Attack';
  return executeCopied(user, target, rng, used, context, execute, toBattleMove(getMoveByName(selected)));
}

function executeRandomCopy(user: PokemonInstance, target: PokemonInstance, rng: Rng, used: string, context: MoveExecutionContext, execute: MoveExecutor, choices: readonly number[]): MoveOutcome {
  if (choices.length === 0) return failed(user, target, used);
  const id = choices[rollInRange(0, choices.length - 1, rng)];
  return id === undefined ? failed(user, target, used) : executeCopied(user, target, rng, used, context, execute, toBattleMove(getMoveById(id)));
}

function executeCopied(user: PokemonInstance, target: PokemonInstance, rng: Rng, used: string, context: MoveExecutionContext, execute: MoveExecutor, copied: BattleMove): MoveOutcome {
  const result = execute(user, target, toBattleMove(copied), rng, context);
  return { ...result, copiedMoveId: copied.id, messages: [used, `${user.species.name} usou ${copied.name}!`, ...result.messages.slice(1)] };
}

function transform(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  if (target.currentHp === 0 || target.species.id === user.species.id) return failed(user, target, used);
  const transformedMoves = target.moves.map((slot) => ({ ...slot, currentPp: 5, maxPp: 5 }));
  const transformed = { ...user, attack: target.attack, defense: target.defense, spAtk: target.spAtk, spDef: target.spDef, speed: target.speed,
    stages: target.stages, ability: target.ability, originalAbility: user.originalAbility ?? user.ability,
    abilitySuppressed: target.abilitySuppressed, moves: transformedMoves,
    transformedMoves: user.transformedMoves ?? user.moves };
  return { user: overridePokemonTypes(transformed, [...pokemonTypes(target)]), target,
    messages: [used, `${user.species.name} transformou-se em ${target.species.name}!`], flinched: false };
}

function singlesSupport(user: PokemonInstance, target: PokemonInstance, _move: BattleMove, used: string): MoveOutcome {
  return failed(user, target, used);
}

function failed(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
}

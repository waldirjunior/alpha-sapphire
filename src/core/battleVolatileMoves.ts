import { genderFromPersonality, pokemonTypes, type BattleMove, type PokemonGender, type PokemonInstance } from './battlePokemon';
import type { MoveOutcome } from './moveExecution';
import { rollInRange, type Rng } from './statusConditions';

export function inflictPartialTrap(
  target: PokemonInstance,
  move: BattleMove,
  rng: Rng
): { target: PokemonInstance; message: string | null } {
  if (target.currentHp === 0 || pokemonTypes(target).includes('ghost') || (target.volatile.partialTrapTurns ?? 0) > 0) {
    return { target, message: null };
  }
  const turns = rollInRange(4, 5, rng);
  return {
    target: { ...target, volatile: { ...target.volatile, partialTrapTurns: turns } },
    message: `${target.species.name} ficou preso por ${move.name}!`,
  };
}

export function disableMove(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const lastMoveId = target.lastMoveId;
  const lastMove = lastMoveId === undefined || lastMoveId === null
    ? undefined
    : target.moves.find((slot) => slot.id === lastMoveId);
  if (target.currentHp === 0 || (target.volatile.disableTurns ?? 0) > 0 || !lastMove || lastMove.currentPp === 0) {
    return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
  }
  const volatile = { ...target.volatile, disableMoveId: lastMove.id, disableTurns: 4 };
  return { user, target: { ...target, volatile }, messages: [used, `${target.species.name} não poderá usar ${lastMove.name}!`], flinched: false };
}

export function encoreMove(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const lastMoveId = target.lastMoveId;
  const lastMove = lastMoveId === undefined || lastMoveId === null
    ? undefined
    : target.moves.find((slot) => slot.id === lastMoveId);
  const disabled = (target.volatile.disableTurns ?? 0) > 0 && target.volatile.disableMoveId === lastMoveId;
  if (target.currentHp === 0 || (target.volatile.encoreTurns ?? 0) > 0 || !lastMove || lastMove.currentPp === 0 || disabled) {
    return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
  }
  const volatile = { ...target.volatile, encoreMoveId: lastMove.id, encoreTurns: 3 };
  return { user, target: { ...target, volatile }, messages: [used, `${target.species.name} só poderá usar ${lastMove.name}!`], flinched: false };
}

export function attractMove(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const userGender = genderOf(user);
  const targetGender = genderOf(target);
  if (target.currentHp === 0 || target.volatile.infatuated || target.ability === 'Oblivious'
    || userGender === 'genderless' || targetGender === 'genderless' || userGender === targetGender) {
    return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
  }
  return {
    user,
    target: { ...target, volatile: { ...target.volatile, infatuated: true } },
    messages: [used, `${target.species.name} apaixonou-se!`],
    flinched: false,
  };
}

function genderOf(pokemon: PokemonInstance): PokemonGender {
  return pokemon.gender ?? genderFromPersonality(pokemon.species.genderRatio, pokemon.personality);
}

export function yawnMove(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const sleepImmune = ['Insomnia', 'Vital Spirit', 'Sweet Veil'].includes(target.ability);
  if (target.currentHp === 0 || target.status !== null || (target.volatile.yawnTurns ?? 0) > 0 || sleepImmune) {
    return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
  }
  return {
    user,
    target: { ...target, volatile: { ...target.volatile, yawnTurns: 2 } },
    messages: [used, `${target.species.name} ficou sonolento!`],
    flinched: false,
  };
}

export function perishSongMove(user: PokemonInstance, target: PokemonInstance, used: string): MoveOutcome {
  const singer = canHearPerishSong(user) ? setPerishSong(user) : user;
  const listener = canHearPerishSong(target) ? setPerishSong(target) : target;
  if (singer === user && listener === target) {
    return { user, target, messages: [used, 'Mas não teve efeito!'], flinched: false };
  }
  return {
    user: singer,
    target: listener,
    messages: [used, 'Todos os Pokémon em campo ouviram o canto do destino!'],
    flinched: false,
  };
}

function canHearPerishSong(pokemon: PokemonInstance): boolean {
  return pokemon.currentHp > 0 && pokemon.ability !== 'Soundproof' && (pokemon.volatile.perishSongTurns ?? 0) === 0;
}

function setPerishSong(pokemon: PokemonInstance): PokemonInstance {
  return { ...pokemon, volatile: { ...pokemon.volatile, perishSongTurns: 3 } };
}

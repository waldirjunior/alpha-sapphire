import type { BagState } from './bag';
import type { PendingMoveLearn, PokemonInstance } from './battle';
import { createPokedex, restorePokedex, type PokedexState } from './pokedex';
import type { GameState } from './types';

export interface SaveData {
  version: 1;
  state: GameState;
  party: PokemonInstance[];
  bag?: BagState;
  pendingMoves?: PendingMoveLearn[];
  caughtCount: number;
  pokedex: PokedexState;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidPokemonInstance(value: unknown): value is PokemonInstance {
  if (!isObjectRecord(value)) return false;
  return (
    isObjectRecord(value.species) &&
    typeof value.species.id === 'string' &&
    typeof value.species.personalIndex === 'number' &&
    isObjectRecord(value.stages) &&
    typeof value.level === 'number' &&
    typeof value.totalExp === 'number' &&
    isObjectRecord(value.ivs) &&
    isObjectRecord(value.evs) &&
    typeof value.nature === 'number' &&
    typeof value.currentHp === 'number' &&
    typeof value.maxHp === 'number' &&
    Array.isArray(value.moves) &&
    value.moves.every(isValidBattleMove)
  );
}

// Saves anteriores à migração para DexSpecies/BattleMove (sem PP/estágios) são descartados.
function isValidBattleMove(value: unknown): boolean {
  return (
    isObjectRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.currentPp === 'number' &&
    typeof value.maxPp === 'number'
  );
}

function isRomCellRecord(value: unknown, validCell: (cell: unknown) => boolean): boolean {
  return isObjectRecord(value) && !Array.isArray(value) && Object.entries(value).every(([key, cell]) =>
    /^(0|[1-9]\d*)$/.test(key) && Number(key) <= 0xffff && validCell(cell));
}

function isValidRomEvents(value: unknown): boolean {
  return isObjectRecord(value) &&
    isRomCellRecord(value.flags, cell => typeof cell === 'boolean') &&
    isRomCellRecord(value.vars, cell => typeof cell === 'number' && Number.isInteger(cell) && cell >= 0 && cell <= 0xffff);
}

function isValidGameState(value: unknown): value is GameState {
  if (!isObjectRecord(value)) return false;
  if (!isObjectRecord(value.player)) return false;
  const expression = value.player.faceExpression;
  if (expression !== undefined && (typeof expression !== 'number' ||
    !Number.isInteger(expression) || expression < 0 || expression > 7)) return false;
  const groundY = value.player.groundY;
  if (groundY !== undefined && (typeof groundY !== 'number' || !Number.isFinite(groundY))) return false;
  return (
    typeof value.player.mapId === 'string' &&
    isObjectRecord(value.player.pos) &&
    typeof value.player.pos.x === 'number' &&
    typeof value.player.pos.z === 'number' &&
    isObjectRecord(value.storyFlags) &&
    (!('romEvents' in value) || isValidRomEvents(value.romEvents))
  );
}

function isValidBagState(value: unknown): value is BagState {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.pokeballs === 'number' &&
    typeof value.potions === 'number' &&
    Array.isArray(value.keyItems) &&
    (!('evolutionItems' in value) || isValidEvolutionItems(value.evolutionItems))
  );
}

function isValidEvolutionItems(value: unknown): value is Record<string, number> {
  return isObjectRecord(value) && !Array.isArray(value) && Object.entries(value).every(([name, count]) =>
    name.length > 0 && typeof count === 'number' && Number.isInteger(count) && count >= 0);
}

function isValidPendingMoves(value: unknown): value is PendingMoveLearn[] {
  return Array.isArray(value) && value.every(move => isObjectRecord(move) &&
    typeof move.partyIndex === 'number' && Number.isInteger(move.partyIndex) && move.partyIndex >= 0 && move.partyIndex < 6 &&
    typeof move.moveId === 'number' && Number.isInteger(move.moveId) && move.moveId > 0);
}

function isValidPokedex(value: unknown): value is PokedexState {
  return isObjectRecord(value) && Array.isArray(value.seenSpecies) &&
    value.seenSpecies.every((speciesId) => typeof speciesId === 'string' && speciesId.length > 0) &&
    Array.isArray(value.caughtSpecies) &&
    value.caughtSpecies.every((speciesId) => typeof speciesId === 'string' && speciesId.length > 0);
}

export function serializeSave(data: Omit<SaveData, 'pokedex'> & { pokedex?: PokedexState }): string {
  return JSON.stringify(data);
}

export function deserializeSave(raw: string): SaveData | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObjectRecord(parsed) || parsed.version !== 1) return null;
    if (!isValidGameState(parsed.state)) return null;
    if (!Array.isArray(parsed.party) || parsed.party.length === 0) return null;
    if (!parsed.party.every(isValidPokemonInstance)) return null;
    if (typeof parsed.caughtCount !== 'number') return null;
    if ('pokedex' in parsed && !isValidPokedex(parsed.pokedex)) return null;
    if ('pendingMoves' in parsed && !isValidPendingMoves(parsed.pendingMoves)) return null;

    const bag = isValidBagState(parsed.bag)
      ? { ...parsed.bag, evolutionItems: parsed.bag.evolutionItems ?? {} }
      : undefined;
    const pokedex = isValidPokedex(parsed.pokedex)
      ? restorePokedex(parsed.pokedex.seenSpecies, parsed.pokedex.caughtSpecies)
      : createPokedex(parsed.party);
    return {
      version: 1,
      state: parsed.state,
      party: parsed.party,
      ...(bag ? { bag } : {}),
      ...(isValidPendingMoves(parsed.pendingMoves) ? { pendingMoves: parsed.pendingMoves } : {}),
      caughtCount: parsed.caughtCount,
      pokedex,
    };
  } catch {
    return null;
  }
}

import type { BagState } from './bag';
import type { PokemonInstance } from './battle';
import type { GameState } from './types';

export interface SaveData {
  version: 1;
  state: GameState;
  party: PokemonInstance[];
  bag?: BagState;
  caughtCount: number;
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
    Array.isArray(value.keyItems)
  );
}

export function serializeSave(data: SaveData): string {
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

    const bag = isValidBagState(parsed.bag) ? parsed.bag : undefined;
    return {
      version: 1,
      state: parsed.state,
      party: parsed.party,
      ...(bag ? { bag } : {}),
      caughtCount: parsed.caughtCount,
    };
  } catch {
    return null;
  }
}

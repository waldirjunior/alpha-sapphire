import type { PokemonInstance } from './battle';
import type { GameState } from './types';

export interface SaveData {
  version: 1;
  state: GameState;
  party: PokemonInstance[];
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
    typeof value.level === 'number' &&
    typeof value.currentHp === 'number' &&
    typeof value.maxHp === 'number' &&
    Array.isArray(value.moves)
  );
}

function isValidGameState(value: unknown): value is GameState {
  if (!isObjectRecord(value)) return false;
  if (!isObjectRecord(value.player)) return false;
  return (
    typeof value.player.mapId === 'string' &&
    isObjectRecord(value.player.pos) &&
    typeof value.player.pos.x === 'number' &&
    typeof value.player.pos.z === 'number' &&
    isObjectRecord(value.storyFlags)
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

    return {
      version: 1,
      state: parsed.state,
      party: parsed.party,
      caughtCount: parsed.caughtCount,
    };
  } catch {
    return null;
  }
}

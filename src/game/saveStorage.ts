import { deserializeSave, serializeSave, type SaveData } from '../core/save';

export interface GameSaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadSavedGame(storage: GameSaveStorage, key: string): SaveData | null {
  const raw = storage.getItem(key);
  return raw ? deserializeSave(raw) : null;
}

export function storeSavedGame(storage: GameSaveStorage, key: string, save: SaveData): void {
  storage.setItem(key, serializeSave(save));
}

export function clearSavedGame(storage: GameSaveStorage, key: string): void {
  storage.removeItem(key);
}

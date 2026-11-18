import type { AmxWorld } from './amxTypes';
import type { GameState } from './types';

export const amxFlagKey = (id: number): string => `amx:flag:${id}`;
export const actorDeletionKey = (zone: number, id: number): string => `${zone}:${id}`;

export function restoreAmxProgress(world: AmxWorld, storyFlags: GameState['storyFlags']): AmxWorld {
  const flags = { ...world.flags }, deletedActors = { ...world.deletedActors };
  for (const [key, value] of Object.entries(storyFlags)) {
    if (typeof value !== 'boolean') continue;
    const flag = /^amx:flag:(-?\d+)$/.exec(key);
    const deletion = /^amx:deleted:(-?\d+:-?\d+)$/.exec(key);
    if (flag) flags[Number(flag[1])] = value;
    if (deletion) deletedActors[deletion[1]] = value;
  }
  return { ...world, flags, deletedActors };
}

export function persistAmxProgress(state: GameState, world: AmxWorld): GameState {
  const storyFlags = { ...state.storyFlags };
  for (const [id, value] of Object.entries(world.flags)) storyFlags[amxFlagKey(Number(id))] = value;
  for (const [key, value] of Object.entries(world.deletedActors)) storyFlags[`amx:deleted:${key}`] = value;
  return { ...state, storyFlags };
}

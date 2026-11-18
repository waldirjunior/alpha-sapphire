import { movePlayer } from '../../core/gameState';
import type { Direction, GameState, MapDefinition } from '../../core/types';
import { stepWarp } from '../../core/warps';
import { MAPS } from '../maps';
import { getZoneMap, type ZoneMapLoader } from './loader';

export function startingMapId(search: string): string {
  return new URLSearchParams(search).get('maps') === 'legacy' ? 'littleroot_town' : 'zone_0006';
}

export function saveStorageKey(search: string): string {
  return startingMapId(search) === 'littleroot_town' ? 'alpha_sapphire_web_save_v1' : 'alpha_sapphire_web_save_v2';
}

export function createMapRepository(getZone: ZoneMapLoader, legacy: Record<string, MapDefinition>) {
  const maps: Record<string, MapDefinition> = { ...legacy };
  const load = async (id: string): Promise<MapDefinition> => {
    if (maps[id]) return maps[id];
    const map = await getZone(id);
    maps[id] = map;
    return map;
  };
  const move = async (state: GameState, direction: Direction): Promise<GameState> => {
    if (state.activeDialogue) return state;
    const current = await load(state.player.mapId);
    const warp = stepWarp(state, direction, current);
    if (warp && (!warp.requiredFlag || state.storyFlags[warp.requiredFlag])) await load(warp.targetMapId);
    return movePlayer(state, direction, maps);
  };
  return { maps, load, move };
}

export const zoneMaps = createMapRepository(getZoneMap, MAPS);

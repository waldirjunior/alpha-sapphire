import { movePlayer } from '../../core/gameState';
import type { Direction, GameState, MapDefinition } from '../../core/types';
import { stepWarp } from '../../core/warps';
import { stepBoundary } from '../../core/boundaries';
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
  const loadOne = async (id: string): Promise<MapDefinition> => {
    if (maps[id]) return maps[id];
    const map = await getZone(id);
    maps[id] = map;
    return map;
  };
  const load = async (id: string): Promise<MapDefinition> => {
    const current = await loadOne(id);
    const neighbors = new Set(current.boundaries?.map((edge) => edge.targetMapId));
    await Promise.all([...neighbors].map(loadOne));
    return current;
  };
  const move = async (state: GameState, direction: Direction): Promise<GameState> => {
    if (state.activeDialogue) return state;
    const current = await load(state.player.mapId);
    const warp = stepWarp(state, direction, current);
    const boundary = !warp && stepBoundary(state.player.pos, direction, current);
    if (warp && (!warp.requiredFlag || state.storyFlags[warp.requiredFlag])) await load(warp.targetMapId);
    if (boundary) await load(boundary.targetMapId);
    return movePlayer(state, direction, maps);
  };
  return { maps, load, move };
}

export const zoneMaps = createMapRepository(getZoneMap, MAPS);

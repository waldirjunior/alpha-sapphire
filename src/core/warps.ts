import type { Direction, GameState, GridPosition, MapDefinition, WarpPoint } from './types';

import { stepPosition } from './gridMovement';
import { stepBoundary } from './boundaries';
export { stepPosition, DIRECTION_DELTAS } from './gridMovement';

export function insideWarp(warp: WarpPoint, pos: GridPosition): boolean {
  return pos.x >= warp.from.x && pos.x < warp.from.x + (warp.width ?? 1) &&
    pos.z >= warp.from.z && pos.z < warp.from.z + (warp.height ?? 1);
}

export function stepWarp(state: GameState, direction: Direction, map: MapDefinition): WarpPoint | undefined {
  const next = stepPosition(state.player.pos, direction);
  if (next.x < 0 || next.z < 0 || next.x >= map.width || next.z >= map.height) return undefined;
  const boundary = stepBoundary(state.player.pos, direction, map);
  return map.warps.find((warp) => insideWarp(warp, next) && !insideWarp(warp, state.player.pos) &&
    !(boundary?.inferred && boundary.targetMapId === warp.targetMapId));
}

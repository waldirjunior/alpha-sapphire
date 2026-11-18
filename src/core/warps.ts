import type { Direction, GameState, GridPosition, MapDefinition, WarpPoint } from './types';

export const DIRECTION_DELTAS: Record<Direction, GridPosition> = {
  up: { x: 0, z: -1 }, down: { x: 0, z: 1 }, left: { x: -1, z: 0 }, right: { x: 1, z: 0 },
};

export function stepPosition(pos: GridPosition, direction: Direction): GridPosition {
  const delta = DIRECTION_DELTAS[direction];
  return { x: pos.x + delta.x, z: pos.z + delta.z };
}

export function insideWarp(warp: WarpPoint, pos: GridPosition): boolean {
  return pos.x >= warp.from.x && pos.x < warp.from.x + (warp.width ?? 1) &&
    pos.z >= warp.from.z && pos.z < warp.from.z + (warp.height ?? 1);
}

export function stepWarp(state: GameState, direction: Direction, map: MapDefinition): WarpPoint | undefined {
  const next = stepPosition(state.player.pos, direction);
  if (next.x < 0 || next.z < 0 || next.x >= map.width || next.z >= map.height) return undefined;
  return map.warps.find((warp) => insideWarp(warp, next) && !insideWarp(warp, state.player.pos));
}

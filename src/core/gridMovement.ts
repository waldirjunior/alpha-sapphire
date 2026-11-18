import type { Direction, GridPosition } from './types';

export const DIRECTION_DELTAS: Record<Direction, GridPosition> = {
  up: { x: 0, z: -1 }, down: { x: 0, z: 1 }, left: { x: -1, z: 0 }, right: { x: 1, z: 0 },
};

export function stepPosition(pos: GridPosition, direction: Direction): GridPosition {
  const delta = DIRECTION_DELTAS[direction];
  return { x: pos.x + delta.x, z: pos.z + delta.z };
}

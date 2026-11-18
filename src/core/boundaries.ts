import type { BoundaryLink, Direction, GridPosition, MapDefinition } from './types';
import { stepPosition } from './warps';

export function stepBoundary(pos: GridPosition, direction: Direction, map: MapDefinition): BoundaryLink | undefined {
  const along = direction === 'left' || direction === 'right' ? 'z' : 'x';
  const across = along === 'z' ? 'x' : 'z';
  return map.boundaries?.find((link) => link.direction === direction && pos[across] === link.from[across] &&
    pos[along] >= link.from[along] && pos[along] < link.from[along] + link.length);
}

export function boundaryTarget(pos: GridPosition, link: BoundaryLink): GridPosition {
  const next = stepPosition(pos, link.direction);
  return { x: next.x + link.offset.x, z: next.z + link.offset.z };
}

export function worldPosition(pos: GridPosition, map: MapDefinition): GridPosition {
  return { x: pos.x + (map.worldOrigin?.x ?? 0), z: pos.z + (map.worldOrigin?.z ?? 0) };
}

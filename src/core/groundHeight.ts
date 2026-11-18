import { worldPosition } from './boundaries';
import type { GridPosition, MapDefinition } from './types';

export function groundHeight(map: MapDefinition, pos: GridPosition): number | null {
  const x = Math.round(pos.x);
  const z = Math.round(pos.z);
  if (x < 0 || z < 0 || x >= map.width || z >= map.height) return null;
  return map.groundHeights?.[z]?.[x] ?? null;
}

export function groundedWorldPosition(pos: GridPosition, map: MapDefinition): GridPosition & { y: number } {
  return { ...worldPosition(pos, map), y: groundHeight(map, pos) ?? 0 };
}

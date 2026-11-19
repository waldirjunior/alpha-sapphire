import { worldPosition } from './boundaries';
import type { GridPosition, MapDefinition } from './types';

export function groundHeight(map: MapDefinition, pos: GridPosition): number | null {
  const x = Math.round(pos.x);
  const z = Math.round(pos.z);
  if (x < 0 || z < 0 || x >= map.width || z >= map.height) return null;
  return map.groundHeights?.[z]?.[x] ?? null;
}

export function selectGroundHeight(map: MapDefinition, pos: GridPosition, referenceY?: number): number | null {
  const x = Math.round(pos.x);
  const z = Math.round(pos.z);
  if (x < 0 || z < 0 || x >= map.width || z >= map.height) return null;
  const primary = groundHeight(map, { x, z });
  const heights = map.groundHeightCandidates?.find(candidate => candidate.x === x && candidate.z === z)?.heights;
  if (!heights?.length || referenceY === undefined || !Number.isFinite(referenceY)) return primary;
  return nearestGroundHeight(heights, referenceY, primary);
}

function nearestGroundHeight(heights: number[], referenceY: number, primary: number | null): number | null {
  const distance = Math.min(...heights.map(height => Math.abs(height - referenceY)));
  const nearest = heights.filter(height => Math.abs(Math.abs(height - referenceY) - distance) <= 1e-4);
  if (nearest.length === 1) return nearest[0];
  if (nearest.some(height => sameHeight(height, referenceY))) return referenceY;
  return primary !== null && nearest.some(height => sameHeight(height, primary)) ? primary : null;
}

function sameHeight(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-4;
}

export function groundedWorldPosition(pos: GridPosition, map: MapDefinition, referenceY?: number): GridPosition & { y: number } {
  return { ...worldPosition(pos, map), y: selectGroundHeight(map, pos, referenceY) ?? 0 };
}

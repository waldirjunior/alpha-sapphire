import type { BoundaryLink, Direction, MapDefinition } from '../../core/types';
import graph from './_neighbors.json';

function direction(value: string): Direction {
  if (value === 'left' || value === 'right' || value === 'up' || value === 'down') return value;
  throw new Error(`Direção de borda inválida: ${value}`);
}

const placements = new Map(Object.entries(graph.zones).map(([id, zone]) => [id, {
  worldOrigin: zone.origin, continuousRegion: zone.component,
  boundaries: zone.neighbors.map((edge): BoundaryLink => ({ ...edge, direction: direction(edge.direction) })),
}]));

export function zonePlacement(id: string): Pick<MapDefinition, 'worldOrigin' | 'continuousRegion' | 'boundaries'> {
  return placements.get(id) ?? {};
}

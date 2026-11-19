import type { Direction, GridPosition, MapDefinition } from './types';

export function southLedgeLanding(map: MapDefinition, pos: GridPosition, direction: Direction): GridPosition | undefined {
  const ledge = { x: pos.x, z: pos.z + 1 };
  if (direction !== 'down' || map.collisions[pos.z]?.[pos.x] !== 0 || map.collisions[ledge.z]?.[ledge.x] !== 1 ||
    !map.southLedges?.some(tile => tile.x === ledge.x && tile.z === ledge.z) || visibleNpcAt(map, ledge)) return;
  return { x: ledge.x, z: ledge.z + 1 };
}

export function lateralLedgeLanding(map: MapDefinition, pos: GridPosition, direction: Direction): GridPosition | undefined {
  if (direction !== 'left' && direction !== 'right') return;
  const deltaX = direction === 'left' ? -1 : 1;
  const ledge = { x: pos.x + deltaX, z: pos.z };
  if (map.collisions[pos.z]?.[pos.x] !== 0 || map.collisions[ledge.z]?.[ledge.x] !== 1 ||
    !map.lateralLedges?.some(tile => tile.x === ledge.x && tile.z === ledge.z && tile.direction === direction) ||
    visibleNpcAt(map, ledge)) return;
  return { x: ledge.x + deltaX, z: ledge.z };
}

function visibleNpcAt(map: MapDefinition, pos: GridPosition): boolean {
  return map.npcs?.some(npc => npc.visible !== false && npc.pos.x === pos.x && npc.pos.z === pos.z) ?? false;
}

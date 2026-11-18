import type { Direction, GridPosition, MapDefinition } from './types';

export function southLedgeLanding(map: MapDefinition, pos: GridPosition, direction: Direction): GridPosition | undefined {
  const ledge = { x: pos.x, z: pos.z + 1 };
  if (direction !== 'down' || map.collisions[pos.z]?.[pos.x] !== 0 || map.collisions[ledge.z]?.[ledge.x] !== 1 ||
    !map.southLedges?.some(tile => tile.x === ledge.x && tile.z === ledge.z) ||
    map.npcs?.some(npc => npc.visible !== false && npc.pos.x === ledge.x && npc.pos.z === ledge.z)) return;
  return { x: ledge.x, z: ledge.z + 1 };
}

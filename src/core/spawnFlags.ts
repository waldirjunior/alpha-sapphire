import type { MapNpc } from './types';

export function isNpcVisible(npc: Pick<MapNpc, 'spawnFlag' | 'visible'>,
  flags: Readonly<Record<number, boolean>>): boolean {
  if (npc.visible === false) return false;
  return npc.spawnFlag === 0 || flags[npc.spawnFlag] !== true;
}

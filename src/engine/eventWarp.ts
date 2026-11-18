import type { Direction, GameState, GridPosition, MapDefinition } from '../core/types';
import { romFacing } from '../data/maps_v2/adapter';

export interface EventWarp { zoneId: number; pos: GridPosition; height: number; facing: Direction; flags: readonly boolean[] }

export function decodeEventWarp(args: readonly number[]): EventWarp {
  if (args.length !== 9 || !args.every(Number.isInteger)) throw new Error('_MapChangeCore: esperadas nove células inteiras');
  const facing = romFacing(args[4] & 255);
  if (!facing) throw new Error(`_MapChangeCore: direção ${args[4]} não suportada`);
  return { zoneId: args[0] & 65535, pos: { x: args[1], z: args[3] }, height: args[2], facing,
    flags: args.slice(5).map(value => value !== 0) };
}

export function eventWarpState(state: GameState, map: MapDefinition, warp: EventWarp): GameState {
  const origin = map.romOrigin ?? { x: 0, z: 0 };
  const pos = { x: warp.pos.x - origin.x, z: warp.pos.z - origin.z };
  if (pos.x < 0 || pos.z < 0 || pos.x >= map.width || pos.z >= map.height) {
    throw new Error(`_MapChangeCore: destino ${map.id} (${pos.x},${pos.z}) fora de ${map.width}×${map.height}`);
  }
  return { ...state, activeDialogue: undefined, player: { ...state.player, mapId: map.id, pos, facing: warp.facing } };
}

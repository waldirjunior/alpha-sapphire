import type { AmxState, AmxWorld } from '../core/amxTypes';
import type { Direction, GameState, MapDefinition, MapNpc, PlayerState } from '../core/types';
import { stepBoundary } from '../core/boundaries';
import { romFacing } from '../data/maps_v2/adapter';
import { decodeEventWarp, type EventWarp } from './eventWarp';

export type EventRequest = { kind: 'text'; text: string } | { kind: 'key' } |
  { kind: 'frames'; count: number } | { kind: 'complete'; value: number } |
  { kind: 'silent-audio'; soundId: number } | { kind: 'warp'; target: EventWarp } |
  { kind: 'opaque'; name: string };

export function classifyEventRequest(state: AmxState, lines: readonly string[]): EventRequest {
  const pending = state.awaiting;
  if (!pending) throw new Error('Evento sem solicitação pendente');
  if (pending.kind === 'ticks') return { kind: 'frames', count: pending.remaining };
  const { name, args } = pending.effect;
  if (name === 'TalkMdlMsg_Seq') {
    const text = lines[args[0]];
    if (text === undefined) throw new Error(`Texto AMX ${args[0]} ausente no banco ativo da zona ${state.world.zoneId}`);
    return { kind: 'text', text };
  }
  if (name === 'LastKeyWait' || name === '_ABKeyWait') return { kind: 'key' };
  if (name === 'SEPlay') return { kind: 'silent-audio', soundId: args[0] };
  if (name === '_MapChangeCore') return { kind: 'warp', target: decodeEventWarp(args) };
  if (name === 'MdlIsHalfSitSkelPreset' || name === 'MdlCanUseTurnAcmd') {
    return { kind: 'complete', value: 0 };
  }
  if (name === '_TalkMdlStartInit' || name === '_TalkMdlEndInit' || name === 'SetKeyWaitMark' || name === 'VanishKeyWaitMark') {
    return { kind: 'complete', value: 0 };
  }
  return { kind: 'opaque', name };
}

export function npcActorId(npc: MapNpc): number {
  return Number(npc.id.split(':').at(-1));
}

export function projectEventActors(map: MapDefinition, world: AmxWorld): MapDefinition {
  const origin = map.romOrigin ?? { x: 0, z: 0 };
  return { ...map, npcs: map.npcs?.map(npc => {
    const actor = world.actors[npcActorId(npc)];
    return actor ? { ...npc, pos: { x: actor.x - origin.x, z: actor.z - origin.z },
      facing: romFacing(actor.direction), visible: actor.visible } : npc;
  }) };
}

export function mapEntryReason(state: GameState, map: MapDefinition, direction: Direction, destination: string): 'boundary' | 'warp' {
  return stepBoundary(state.player.pos, direction, map)?.targetMapId === destination ? 'boundary' : 'warp';
}

export function projectEventPlayer(state: GameState, map: MapDefinition, world: AmxWorld, applyPlayer: boolean): GameState {
  const player = world.actors[255];
  if (!applyPlayer || !player) return state;
  const origin = map.romOrigin ?? { x: 0, z: 0 };
  return { ...state, player: { ...state.player, pos: { x: player.x - origin.x, z: player.z - origin.z },
    facing: romFacing(player.direction) ?? state.player.facing } };
}

export function facingNpc(player: PlayerState, map: MapDefinition): MapNpc | undefined {
  const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[player.facing];
  return map.npcs?.find(npc => npc.visible !== false &&
    npc.pos.x === player.pos.x + delta[0] && npc.pos.z === player.pos.z + delta[1]);
}

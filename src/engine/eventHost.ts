import type { AmxState, AmxWorld } from '../core/amxTypes';
import type { MapDefinition, MapNpc, PlayerState } from '../core/types';
import { romFacing } from '../data/maps_v2/adapter';

export type EventRequest = { kind: 'text'; text: string } | { kind: 'key' } |
  { kind: 'frames'; count: number } | { kind: 'complete'; value: number } |
  { kind: 'silent-audio'; soundId: number } |
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
  if (name === '_FieldMapBlockIsLoading' || name === 'MdlIsHalfSitSkelPreset' || name === 'MdlCanUseTurnAcmd') {
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
  return { ...map, npcs: map.npcs?.map(npc => {
    const actor = world.actors[npcActorId(npc)];
    return actor ? { ...npc, pos: { x: actor.x, z: actor.z }, facing: romFacing(actor.direction), visible: actor.visible } : npc;
  }) };
}

export function facingNpc(player: PlayerState, map: MapDefinition): MapNpc | undefined {
  const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[player.facing];
  return map.npcs?.find(npc => npc.visible !== false &&
    npc.pos.x === player.pos.x + delta[0] && npc.pos.z === player.pos.z + delta[1]);
}

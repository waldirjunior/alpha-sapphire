import type { GameState, MapDefinition } from '../core/types';
import { romFacing } from '../data/maps_v2/adapter';
import { ZoneEvents } from './zoneEvents';

export function createGameEvents(getState: () => GameState, setState: (state: GameState) => void,
  maps: Record<string, MapDefinition>, syncUi: () => void): ZoneEvents {
  const dialogue = (text: string | null, sourceId = 'amx'): void => {
    setState({ ...getState(), activeDialogue: text === null ? undefined : { sourceId, text } });
    syncUi();
  };
  return new ZoneEvents({
    state: getState,
    map: () => maps[getState().player.mapId],
    project: (map, world) => {
      maps[map.id] = map;
      const player = world.actors[255];
      const state = getState();
      if (player) setState({ ...state, player: { ...state.player, pos: { x: player.x, z: player.z },
        facing: romFacing(player.direction) ?? state.player.facing } });
      syncUi();
    },
    dialogue,
    frames: waitEventFrames,
    silentAudio: soundId => console.warn(`SEPlay(${soundId}): efeito sonoro não extraído; host em modo silencioso (P-008)`),
    report: message => {
      console.warn('Evento AMX interrompido', message);
      dialogue(`Evento indisponível: ${message}`, 'amx-pending');
    },
  });
}

async function waitEventFrames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

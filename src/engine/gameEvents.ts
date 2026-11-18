import type { GameState, MapDefinition } from '../core/types';
import { projectEventPlayer } from './eventHost';
import { persistAmxProgress } from '../core/amxProgress';
import { ZoneEvents } from './zoneEvents';
import { zoneMaps } from '../data/maps_v2/runtime';
import { eventWarpState } from './eventWarp';
import { transitionMap } from './mapTransition';

export function createGameEvents(getState: () => GameState, setState: (state: GameState) => void,
  maps: Record<string, MapDefinition>, syncUi: () => void, surface: Parameters<typeof transitionMap>[0]): ZoneEvents {
  const dialogue = (text: string | null, sourceId = 'amx'): void => {
    setState({ ...getState(), activeDialogue: text === null ? undefined : { sourceId, text } });
    syncUi();
  };
  return new ZoneEvents({
    state: getState,
    map: () => maps[getState().player.mapId],
    project: (map, world, player) => {
      maps[map.id] = map;
      setState(persistAmxProgress(projectEventPlayer(getState(), map, world, player), world));
      syncUi();
    },
    dialogue,
    frames: waitEventFrames,
    warp: async (target, active) => {
      const map = await zoneMaps.load(`zone_${String(target.zoneId).padStart(4, '0')}`);
      if (!active()) return;
      const next = eventWarpState(getState(), map, target);
      console.warn(`_MapChangeCore: altura ${target.height}, flags ${target.flags.join(',')}; host usa solo e fade genérico (P-013)`);
      await transitionMap(surface, 1, () => { if (active()) { setState(next); syncUi(); } });
    },
    silentAudio: soundId => console.warn(`SEPlay(${soundId}): efeito sonoro não extraído; host em modo silencioso (P-008)`),
    report: message => console.warn('Evento AMX pendente', message),
  });
}

async function waitEventFrames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

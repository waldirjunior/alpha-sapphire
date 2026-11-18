import { describe, expect, it } from 'vitest';
import { decodeEventWarp, eventWarpState } from './eventWarp';
import type { GameState, MapDefinition } from '../core/types';

describe('ABI _MapChangeCore', () => {
  const state: GameState = { player: { id: 'p', mapId: 'old', pos: { x: 1, z: 2 }, facing: 'down' }, storyFlags: {} };
  const map: MapDefinition = { id: 'zone_0006', zoneId: 6, name: 'Town', width: 40, height: 40,
    romOrigin: { x: 80, z: 160 }, collisions: [], warps: [] };
  it('usa zona/x/y/z/direção, não um par zona/índice de warp, e converte origem ROM', () => {
    const request = decodeEventWarp([6, 95, 3, 178, 1, 1, 0, 1, 0]);
    expect(request).toEqual({ zoneId: 6, pos: { x: 95, z: 178 }, height: 3, facing: 'up', flags: [true, false, true, false] });
    expect(eventWarpState(state, map, request).player).toMatchObject({ mapId: map.id, pos: { x: 15, z: 18 }, facing: 'up' });
    expect(state.player.mapId).toBe('old');
  });
  it('recusa destino off-map/direção desconhecida sem mudar origem', () => {
    expect(() => decodeEventWarp([6, 0])).toThrow('_MapChangeCore');
    expect(() => decodeEventWarp([6, 95, 0, 178, 9, 0, 0, 0, 0])).toThrow('9');
    expect(() => eventWarpState(state, map, decodeEventWarp([6, 1, 0, 2, 0, 0, 0, 0, 0]))).toThrow('fora');
  });
});

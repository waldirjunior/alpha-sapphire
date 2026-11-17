import { describe, expect, it } from 'vitest';
import zoneAudio from '../data/zone_audio.json';
import { MAP_ZONE_IDS } from '../data/audio/mapZones';
import { bgmUrl, resolveMapBgm, type ZoneAudioEntry } from './zoneAudio';

const FIXTURE: readonly ZoneAudioEntry[] = [
  { zone: 6, bgmName: 'bgm_sg_t_01', hasMp3: true },
  { zone: 23, bgmName: 'bgm_sg_r_a', hasMp3: true },
  { zone: 99, bgmName: 'bgm_sg_missing', hasMp3: false },
];

describe('map → zone → BGM adapter (P-008)', () => {
  it('resolves the track through the map zone id', () => {
    const zones = { littleroot_town: 6, route_101: 23, ghost_map: 99 };
    expect(resolveMapBgm('littleroot_town', zones, FIXTURE)).toBe('bgm_sg_t_01');
    expect(resolveMapBgm('route_101', zones, FIXTURE)).toBe('bgm_sg_r_a');
  });

  it('falls back to silence for unknown maps, unknown zones and missing mp3s', () => {
    expect(resolveMapBgm('unknown_map', { route_101: 23 }, FIXTURE)).toBeNull();
    expect(resolveMapBgm('route_101', { route_101: 500 }, FIXTURE)).toBeNull();
    expect(resolveMapBgm('ghost_map', { ghost_map: 99 }, FIXTURE)).toBeNull();
  });

  it('maps every slice map to the expected ROM track', () => {
    const tracks = Object.fromEntries(Object.keys(MAP_ZONE_IDS).map((mapId) => [mapId, resolveMapBgm(mapId, MAP_ZONE_IDS, zoneAudio)]));
    expect(tracks).toEqual({
      littleroot_town: 'bgm_sg_t_01',
      oldale_town: 'bgm_sg_t_02',
      petalburg_city: 'bgm_sg_c_01',
      route_101: 'bgm_sg_r_a',
      route_102: 'bgm_sg_r_a',
      route_102_west: 'bgm_sg_r_a',
      route_103: 'bgm_sg_r_a',
      brendan_house: 'bgm_sg_t_01',
      may_house: 'bgm_sg_t_01',
      birch_lab: 'bgm_sg_labo',
      oldale_pokecenter: 'bgm_sg_pokecen',
      oldale_mart: 'bgm_sg_fs',
    });
  });

  it('builds the public asset URL respecting the Vite base path', () => {
    expect(bgmUrl('/', 'bgm_sg_t_01')).toBe('/assets/audio/bgm_sg_t_01.mp3');
    expect(bgmUrl('/alpha', 'bgm_sg_r_a')).toBe('/alpha/assets/audio/bgm_sg_r_a.mp3');
  });
});

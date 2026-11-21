import { describe, expect, it } from 'vitest';
import {
  AREA_NAV_CLYT_LAYOUT,
  areaNavMarkerTexture,
  areaNavNativeMapPoint,
  areaNavTextureUrl,
  setNativeMapAvailability,
} from './areaNavAssets';

describe('AreaNav ROM assets', () => {
  it('keeps screen and map bounds from map_lower.bclyt', () => {
    expect(AREA_NAV_CLYT_LAYOUT).toEqual({
      screen: { width: 320, height: 240 },
      map: { x: 0, y: 15, width: 380, height: 270 },
      title: { width: 190, height: 30 },
    });
  });

  it('uses the local AreaNav asset directory and native city marker files', () => {
    expect(areaNavTextureUrl('poke_navi_map.png')).toBe('/assets/ui/arenav/poke_navi_map.png');
    expect(areaNavMarkerTexture('city')).toBe('map_city_icon02.png');
    expect(areaNavMarkerTexture('town')).toBe('map_city_icon01.png');
    expect(areaNavMarkerTexture('landmark')).toBeNull();
    expect(areaNavMarkerTexture('route')).toBeNull();
    expect(areaNavNativeMapPoint(395, 418)).toEqual({ x: 273, y: 318 });
  });

  it('switches to the vector fallback after the native map image fails', () => {
    const calls: Array<[string, boolean]> = [];
    const target = { classList: { toggle: (name: string, enabled: boolean) => calls.push([name, enabled]) } };

    setNativeMapAvailability(target, true);
    setNativeMapAvailability(target, false);

    expect(calls).toEqual([['has-native-map', true], ['has-native-map', false]]);
  });
});

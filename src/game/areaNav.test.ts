import { describe, expect, it } from 'vitest';
import { bringSelectedLocationForward } from './areaNav';
import {
  AREA_NAV_CLYT_LAYOUT,
  areaNavMarkerSize,
  areaNavMarkerTexture,
  areaNavNativeMapPoint,
  areaNavViewportOffset,
  areaNavTextureUrl,
  setNativeMapAvailability,
} from './areaNavAssets';

describe('AreaNav ROM assets', () => {
  it('keeps screen and map bounds from map_lower.bclyt', () => {
    expect(AREA_NAV_CLYT_LAYOUT).toEqual({
      screen: { width: 320, height: 240 },
      map: { x: 0, y: 15, width: 380, height: 270 },
      viewport: { x: 0, y: 15, width: 245, height: 176 },
      title: { width: 190, height: 30 },
    });
  });

  it('uses the local AreaNav asset directory and native city marker files', () => {
    expect(areaNavTextureUrl('poke_navi_map.png')).toBe('/assets/ui/arenav/poke_navi_map.png');
    expect(areaNavMarkerTexture('city')).toBe('map_city_icon02.png');
    expect(areaNavMarkerTexture('town')).toBe('map_city_icon01.png');
    expect(areaNavMarkerTexture('landmark')).toBeNull();
    expect(areaNavMarkerTexture('route')).toBeNull();
    expect(areaNavMarkerSize('city')).toEqual({ width: 32, height: 16 });
    expect(areaNavMarkerSize('town')).toEqual({ width: 16, height: 16 });
    expect(areaNavNativeMapPoint(395, 418)).toEqual({ x: 129.675, y: 186.65217391304347 });
    expect(areaNavViewportOffset({ x: 129.675, y: 186.65217391304347 })).toEqual({ x: -7, y: -94 });
    expect(areaNavViewportOffset({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(areaNavViewportOffset({ x: 380, y: 270 })).toEqual({ x: -135, y: -94 });
  });

  it('switches to the vector fallback after the native map image fails', () => {
    const calls: Array<[string, boolean]> = [];
    const target = { classList: { toggle: (name: string, enabled: boolean) => calls.push([name, enabled]) } };

    setNativeMapAvailability(target, true);
    setNativeMapAvailability(target, false);

    expect(calls).toEqual([['has-native-map', true], ['has-native-map', false]]);
  });

  it('keeps the player avatar marker above the selected location marker', () => {
    const littleroot = { dataset: { locationId: 'littleroot-town' } };
    const rustboro = { dataset: { locationId: 'rustboro-city' } };
    const player = { dataset: {} };
    const order: Array<{ dataset: { locationId?: string } }> = [littleroot, rustboro, player];
    const svg = {
      querySelectorAll: () => [littleroot, rustboro],
      querySelector: () => player,
      insertBefore: (node: typeof littleroot, child: typeof player | null) => {
        const current = order.indexOf(node);
        if (current >= 0) order.splice(current, 1);
        const before = child ? order.indexOf(child) : -1;
        order.splice(before >= 0 ? before : order.length, 0, node);
      },
      appendChild: (node: typeof littleroot) => {
        const current = order.indexOf(node);
        if (current >= 0) order.splice(current, 1);
        order.push(node);
      },
    };

    bringSelectedLocationForward(svg, 'littleroot-town');

    expect(order.map((node) => node.dataset.locationId ?? 'player')).toEqual([
      'rustboro-city',
      'littleroot-town',
      'player',
    ]);
  });
});

import type { HoennLocationKind } from '../core/hoennMap';

export const AREA_NAV_CLYT_LAYOUT = {
  screen: { width: 320, height: 240 },
  map: { x: 0, y: 15, width: 380, height: 270 },
  title: { width: 190, height: 30 },
} as const;

export type AreaNavTextureName =
  | 'poke_navi_map.png'
  | 'map_city_icon01.png'
  | 'map_city_icon02.png'
  | 'map_city_icon03.png'
  | 'hero_obj.png'
  | 'heroine_obj.png';

const CITY_MARKERS: Record<HoennLocationKind, AreaNavTextureName | null> = {
  city: 'map_city_icon02.png',
  town: 'map_city_icon01.png',
  route: null,
  landmark: null,
};

export function areaNavTextureUrl(filename: AreaNavTextureName): string {
  return `/assets/ui/arenav/${filename}`;
}

export function areaNavMarkerTexture(kind: HoennLocationKind): AreaNavTextureName | null {
  return CITY_MARKERS[kind];
}

export function areaNavPlayerTexture(gender: 'male' | 'female'): AreaNavTextureName {
  return gender === 'female' ? 'heroine_obj.png' : 'hero_obj.png';
}

export function areaNavNativeMapPoint(x: number, y: number): { x: number; y: number } {
  return { x: (x - 395) * 1.1 + 273, y: (y - 418) * 0.83 + 318 };
}

export function setNativeMapAvailability(
  target: { classList: { toggle(name: string, force: boolean): void } },
  available: boolean,
): void {
  target.classList.toggle('has-native-map', available);
}

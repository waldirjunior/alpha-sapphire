import type { HoennLocationKind } from '../core/hoennMap';

export const AREA_NAV_CLYT_LAYOUT = {
  screen: { width: 320, height: 240 },
  map: { x: 0, y: 15, width: 380, height: 270 },
  viewport: { x: 0, y: 15, width: 245, height: 176 },
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

const CITY_MARKER_SIZES: Record<HoennLocationKind, { width: number; height: number } | null> = {
  city: { width: 32, height: 16 },
  town: { width: 16, height: 16 },
  route: null,
  landmark: null,
};

const LOCATION_VIEWBOX = { width: 800, height: 460 } as const;

export function areaNavTextureUrl(filename: AreaNavTextureName): string {
  return `/assets/ui/arenav/${filename}`;
}

export function areaNavMarkerTexture(kind: HoennLocationKind): AreaNavTextureName | null {
  return CITY_MARKERS[kind];
}

export function areaNavMarkerSize(kind: HoennLocationKind): { width: number; height: number } | null {
  return CITY_MARKER_SIZES[kind];
}

export function areaNavPlayerTexture(gender: 'male' | 'female'): AreaNavTextureName {
  return gender === 'female' ? 'heroine_obj.png' : 'hero_obj.png';
}

export function areaNavNativeMapPoint(x: number, y: number): { x: number; y: number } {
  const locationX = (x - 395) * 1.1 + 273;
  const locationY = (y - 418) * 0.83 + 318;
  return {
    x: locationX * AREA_NAV_CLYT_LAYOUT.map.width / LOCATION_VIEWBOX.width,
    y: locationY * AREA_NAV_CLYT_LAYOUT.map.height / LOCATION_VIEWBOX.height,
  };
}

export function areaNavViewportOffset(point: { x: number; y: number }): { x: number; y: number } {
  const { map, viewport } = AREA_NAV_CLYT_LAYOUT;
  return {
    x: Math.round(clamp(viewport.width / 2 - point.x, viewport.width - map.width, 0)),
    y: Math.round(clamp(viewport.height / 2 - point.y, viewport.height - map.height, 0)),
  };
}

export function setNativeMapAvailability(
  target: { classList: { toggle(name: string, force: boolean): void } },
  available: boolean,
): void {
  target.classList.toggle('has-native-map', available);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export interface ZoneEnvironment {
  readonly backgroundColor: string;
  readonly fogColor: string;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly hemisphereSkyColor: string;
  readonly hemisphereGroundColor: string;
  readonly hemisphereIntensity: number;
  readonly directionalColor: string;
  readonly directionalIntensity: number;
}

// A-075 leaves native fragment-light values unresolved; these are scene fits, not PICA shader values.
const OUTDOOR: ZoneEnvironment = {
  backgroundColor: '#7dd3fc', fogColor: '#93c5fd', fogNear: 32, fogFar: 95,
  hemisphereSkyColor: '#f0f9ff', hemisphereGroundColor: '#365314', hemisphereIntensity: 0.78,
  directionalColor: '#fffbeb', directionalIntensity: 0.72,
};

const RUSTURF_TUNNEL: ZoneEnvironment = {
  backgroundColor: '#18221d', fogColor: '#324135', fogNear: 18, fogFar: 66,
  hemisphereSkyColor: '#c2cfc3', hemisphereGroundColor: '#4d574c', hemisphereIntensity: 1,
  directionalColor: '#dce6d2', directionalIntensity: 0.8,
};

const METEOR_FALLS: ZoneEnvironment = {
  backgroundColor: '#17130d', fogColor: '#75613e', fogNear: 85, fogFar: 145,
  hemisphereSkyColor: '#fff0bd', hemisphereGroundColor: '#685237', hemisphereIntensity: 1.05,
  directionalColor: '#ffe39a', directionalIntensity: 1.15,
};

const INTERIOR: ZoneEnvironment = {
  backgroundColor: '#151515', fogColor: '#332e27', fogNear: 15, fogFar: 45,
  hemisphereSkyColor: '#eadfc7', hemisphereGroundColor: '#493d2d', hemisphereIntensity: 0.72,
  directionalColor: '#ffe1a6', directionalIntensity: 0.22,
};

const INTERIOR_MAP_IDS = new Set([
  'brendan_house', 'may_house', 'birch_lab', 'oldale_pokecenter', 'oldale_mart',
]);

export function zoneEnvironment(mapId: string): ZoneEnvironment {
  if (mapId === 'zone_0075') return RUSTURF_TUNNEL;
  if (mapId === 'zone_0071') return METEOR_FALLS;
  if (INTERIOR_MAP_IDS.has(mapId)) return INTERIOR;
  return OUTDOOR;
}

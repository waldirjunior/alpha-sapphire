export interface WildEncounterEntry {
  speciesId: string;
  minLevel: number;
  maxLevel: number;
  weight: number;
}

export const ROUTE_101_ENCOUNTERS: WildEncounterEntry[] = [
  { speciesId: 'poochyena', minLevel: 2, maxLevel: 3, weight: 40 },
  { speciesId: 'zigzagoon', minLevel: 2, maxLevel: 3, weight: 30 },
  { speciesId: 'wurmple', minLevel: 2, maxLevel: 3, weight: 30 },
];

export const ROUTE_102_ENCOUNTERS: WildEncounterEntry[] = [
  { speciesId: 'poochyena', minLevel: 3, maxLevel: 4, weight: 30 },
  { speciesId: 'zigzagoon', minLevel: 3, maxLevel: 4, weight: 25 },
  { speciesId: 'wurmple', minLevel: 3, maxLevel: 4, weight: 20 },
  { speciesId: 'lotad', minLevel: 3, maxLevel: 4, weight: 15 },
  { speciesId: 'ralts', minLevel: 4, maxLevel: 4, weight: 10 },
];

export const MAP_ENCOUNTERS: Record<string, WildEncounterEntry[]> = {
  route_101: ROUTE_101_ENCOUNTERS,
  route_102: ROUTE_102_ENCOUNTERS,
  route_102_west: ROUTE_102_ENCOUNTERS,
  route_103: ROUTE_101_ENCOUNTERS,
};

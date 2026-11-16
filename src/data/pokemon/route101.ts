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

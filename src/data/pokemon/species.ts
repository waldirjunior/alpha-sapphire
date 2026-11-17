export type PokemonType =
  | 'normal'
  | 'grass'
  | 'fire'
  | 'water'
  | 'dark'
  | 'bug'
  | 'psychic'
  | 'fairy';

export interface MoveDefinition {
  id: string;
  name: string;
  type: PokemonType;
  category: 'physical' | 'special';
  power: number;
  accuracy: number;
}

export interface PokemonSpecies {
  id: string;
  dexNumber: number;
  name: string;
  types: PokemonType[];
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
  moves: MoveDefinition[];
}

export const MOVES: Record<string, MoveDefinition> = {
  pound: { id: 'pound', name: 'Pound', type: 'normal', category: 'physical', power: 40, accuracy: 100 },
  absorb: { id: 'absorb', name: 'Absorb', type: 'grass', category: 'special', power: 20, accuracy: 100 },
  scratch: { id: 'scratch', name: 'Scratch', type: 'normal', category: 'physical', power: 40, accuracy: 100 },
  ember: { id: 'ember', name: 'Ember', type: 'fire', category: 'special', power: 40, accuracy: 100 },
  tackle: { id: 'tackle', name: 'Tackle', type: 'normal', category: 'physical', power: 50, accuracy: 100 },
  water_gun: { id: 'water_gun', name: 'Water Gun', type: 'water', category: 'special', power: 40, accuracy: 100 },
  bite: { id: 'bite', name: 'Bite', type: 'dark', category: 'physical', power: 60, accuracy: 100 },
  bug_bite: { id: 'bug_bite', name: 'Bug Bite', type: 'bug', category: 'physical', power: 60, accuracy: 100 },
  confusion: { id: 'confusion', name: 'Confusion', type: 'psychic', category: 'special', power: 50, accuracy: 100 },
  disarming_voice: { id: 'disarming_voice', name: 'Disarming Voice', type: 'fairy', category: 'special', power: 40, accuracy: 101 },
};

export const SPECIES: Record<string, PokemonSpecies> = {
  treecko: {
    id: 'treecko',
    dexNumber: 252,
    name: 'Treecko',
    types: ['grass'],
    baseStats: { hp: 40, attack: 45, defense: 35, spAtk: 65, spDef: 55, speed: 70 },
    moves: [MOVES.pound, MOVES.absorb],
  },
  torchic: {
    id: 'torchic',
    dexNumber: 255,
    name: 'Torchic',
    types: ['fire'],
    baseStats: { hp: 45, attack: 60, defense: 40, spAtk: 70, spDef: 50, speed: 45 },
    moves: [MOVES.scratch, MOVES.ember],
  },
  mudkip: {
    id: 'mudkip',
    dexNumber: 258,
    name: 'Mudkip',
    types: ['water'],
    baseStats: { hp: 50, attack: 70, defense: 50, spAtk: 50, spDef: 50, speed: 40 },
    moves: [MOVES.tackle, MOVES.water_gun],
  },
  poochyena: {
    id: 'poochyena',
    dexNumber: 261,
    name: 'Poochyena',
    types: ['dark'],
    baseStats: { hp: 35, attack: 55, defense: 35, spAtk: 30, spDef: 30, speed: 35 },
    moves: [MOVES.tackle, MOVES.bite],
  },
  zigzagoon: {
    id: 'zigzagoon',
    dexNumber: 263,
    name: 'Zigzagoon',
    types: ['normal'],
    baseStats: { hp: 38, attack: 30, defense: 41, spAtk: 30, spDef: 41, speed: 60 },
    moves: [MOVES.tackle],
  },
  wurmple: {
    id: 'wurmple',
    dexNumber: 265,
    name: 'Wurmple',
    types: ['bug'],
    baseStats: { hp: 45, attack: 45, defense: 35, spAtk: 20, spDef: 30, speed: 20 },
    moves: [MOVES.tackle, MOVES.bug_bite],
  },
  lotad: {
    id: 'lotad',
    dexNumber: 270,
    name: 'Lotad',
    types: ['water', 'grass'],
    baseStats: { hp: 40, attack: 30, defense: 30, spAtk: 40, spDef: 50, speed: 30 },
    moves: [MOVES.absorb, MOVES.water_gun],
  },
  ralts: {
    id: 'ralts',
    dexNumber: 280,
    name: 'Ralts',
    types: ['psychic', 'fairy'],
    baseStats: { hp: 28, attack: 25, defense: 25, spAtk: 45, spDef: 35, speed: 40 },
    moves: [MOVES.confusion, MOVES.disarming_voice],
  },
};

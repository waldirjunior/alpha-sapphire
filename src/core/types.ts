import type { ZoneEncounterSlot } from './wildPokemon';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  x: number;
  z: number;
}

export interface WarpPoint {
  from: GridPosition;
  targetMapId: string;
  targetPos: GridPosition;
  width?: number;
  height?: number;
  faceDirection?: Direction;
  transitionEffect?: number;
  requiredFlag?: string;
  blockedMessage?: string;
}

export interface TrainerPokemonSpec {
  speciesId: string;
  level: number;
}

export interface TrainerSpec extends TrainerPokemonSpec {
  name: string;
  /** Time completo (até 6); sem ele o treinador usa só `speciesId`/`level`. */
  team?: TrainerPokemonSpec[];
}

export interface Interactable {
  id: string;
  pos: GridPosition;
  kind: 'sign' | 'npc';
  text: string;
  requiredFlag?: string;
  altText?: string;
  setFlag?: string;
  npcModel?: 'may' | 'npc';
  facing?: Direction;
  sightRange?: number;
  trainer?: TrainerSpec;
}

export interface MapNpc {
  id: string;
  pos: GridPosition;
  modelUrl: string;
  facing?: Direction;
  model: number;
  script: number;
  spawnFlag: number;
}

export interface BoundaryLink {
  targetMapId: string;
  direction: Direction;
  from: GridPosition;
  length: number;
  offset: GridPosition;
  inferred: boolean;
}

export interface MapDefinition {
  boundaries?: readonly BoundaryLink[];
  worldOrigin?: GridPosition;
  continuousRegion?: string;
  zoneId?: number;
  spawnDerived?: boolean;
  spawnPolicy?: string;
  npcs?: MapNpc[];
  encounters?: readonly ZoneEncounterSlot[];
  modelChunks?: { modelUrl: string; offset: GridPosition }[];
  id: string;
  name: string;
  width: number;
  height: number;
  /** Posição inicial padrão ao entrar no mapa sem warp específico */
  spawnPos?: GridPosition;
  /** 0 = livre, 1 = bloqueado */
  collisions: number[][];
  /** 0 = normal, 1 = bloqueado, 2 = grama alta (encontro selvagem) */
  terrain?: number[][];
  warps: WarpPoint[];
  interactables?: Interactable[];
  /** Caminho opcional para o modelo .glb extraído da ROM */
  modelUrl?: string;
  /** Caminho opcional para props/vegetação extraídos da seção 5 do GR */
  propsUrl?: string;
}

export interface ActiveDialogue {
  sourceId: string;
  text: string;
}

export interface PlayerState {
  id: string;
  mapId: string;
  pos: GridPosition;
  facing: Direction;
  gender?: 'male' | 'female';
  playerName?: string;
}

export interface GameState {
  player: PlayerState;
  storyFlags: Record<string, boolean>;
  activeDialogue?: ActiveDialogue;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  x: number;
  z: number;
}

export interface WarpPoint {
  from: GridPosition;
  targetMapId: string;
  targetPos: GridPosition;
  requiredFlag?: string;
  blockedMessage?: string;
}

export interface TrainerSpec {
  name: string;
  speciesId: string;
  level: number;
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

export interface MapDefinition {
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
}

export interface GameState {
  player: PlayerState;
  storyFlags: Record<string, boolean>;
  activeDialogue?: ActiveDialogue;
}

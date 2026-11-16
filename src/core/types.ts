export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  x: number;
  z: number;
}

export interface WarpPoint {
  from: GridPosition;
  targetMapId: string;
  targetPos: GridPosition;
}

export interface Interactable {
  id: string;
  pos: GridPosition;
  kind: 'sign' | 'npc';
  text: string;
  setFlag?: string;
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

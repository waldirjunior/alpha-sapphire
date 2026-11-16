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
  /** Caminho opcional para o modelo .glb extraído da ROM */
  modelUrl?: string;
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
}

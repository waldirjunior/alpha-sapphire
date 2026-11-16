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
  /** 0 = livre, 1 = bloqueado */
  collisions: number[][];
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

import type { Direction, GameState, GridPosition, MapDefinition } from './types';

export function createInitialState(
  startMapId = 'littleroot_town',
  maps?: Record<string, MapDefinition>
): GameState {
  const spawn = maps?.[startMapId]?.spawnPos;
  return {
    player: {
      id: 'local-player',
      mapId: startMapId,
      pos: spawn ? { ...spawn } : { x: 5, z: 5 },
      facing: 'down',
    },
    storyFlags: {
      intro_completed: false,
      starter_chosen: false,
    },
  };
}

const DIRECTION_DELTAS: Record<Direction, GridPosition> = {
  up: { x: 0, z: -1 },
  down: { x: 0, z: 1 },
  left: { x: -1, z: 0 },
  right: { x: 1, z: 0 },
};

export function isWalkable(map: MapDefinition, pos: GridPosition): boolean {
  if (pos.x < 0 || pos.z < 0 || pos.x >= map.width || pos.z >= map.height) {
    return false;
  }
  return map.collisions[pos.z]?.[pos.x] === 0;
}

export function isTallGrass(map: MapDefinition, pos: GridPosition): boolean {
  if (pos.x < 0 || pos.z < 0 || pos.x >= map.width || pos.z >= map.height) {
    return false;
  }
  return map.terrain?.[pos.z]?.[pos.x] === 2;
}

export function movePlayer(
  state: GameState,
  direction: Direction,
  maps: Record<string, MapDefinition>
): GameState {
  const currentMap = maps[state.player.mapId];
  if (!currentMap) return state;

  const delta = DIRECTION_DELTAS[direction];
  const nextPos: GridPosition = {
    x: state.player.pos.x + delta.x,
    z: state.player.pos.z + delta.z,
  };

  if (!isWalkable(currentMap, nextPos)) {
    return {
      ...state,
      player: { ...state.player, facing: direction },
    };
  }

  const warp = currentMap.warps.find(
    (w) => w.from.x === nextPos.x && w.from.z === nextPos.z
  );

  if (warp && maps[warp.targetMapId]) {
    return {
      ...state,
      player: {
        ...state.player,
        mapId: warp.targetMapId,
        pos: { ...warp.targetPos },
        facing: direction,
      },
    };
  }

  return {
    ...state,
    player: {
      ...state.player,
      pos: nextPos,
      facing: direction,
    },
  };
}

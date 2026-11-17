import type { Direction, GameState, GridPosition, Interactable, MapDefinition } from './types';

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
  if (state.activeDialogue) return state;

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
    if (warp.requiredFlag && !state.storyFlags[warp.requiredFlag]) {
      return {
        ...state,
        player: { ...state.player, facing: direction },
        activeDialogue: {
          sourceId: `warp:${warp.targetMapId}`,
          text: warp.blockedMessage ?? 'Esta passagem ainda está bloqueada.',
        },
      };
    }
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

export function interact(
  state: GameState,
  maps: Record<string, MapDefinition>
): GameState {
  if (state.activeDialogue) {
    const { activeDialogue: _removed, ...rest } = state;
    return rest;
  }

  const currentMap = maps[state.player.mapId];
  if (!currentMap?.interactables?.length) return state;

  const delta = DIRECTION_DELTAS[state.player.facing];
  const targetPos: GridPosition = {
    x: state.player.pos.x + delta.x,
    z: state.player.pos.z + delta.z,
  };

  const target = currentMap.interactables.find(
    (item) => item.pos.x === targetPos.x && item.pos.z === targetPos.z
  );
  if (!target) return state;

  const resolvedText =
    target.requiredFlag && target.altText && state.storyFlags[target.requiredFlag]
      ? target.altText
      : target.text;

  return {
    ...state,
    storyFlags: target.setFlag
      ? { ...state.storyFlags, [target.setFlag]: true }
      : state.storyFlags,
    activeDialogue: {
      sourceId: target.id,
      text: resolvedText,
    },
  };
}

/** Verifica se o jogador entrou na linha de visão de algum treinador ainda não derrotado. */
export function findTriggeredTrainer(
  state: GameState,
  maps: Record<string, MapDefinition>
): Interactable | null {
  if (state.activeDialogue) return null;
  const currentMap = maps[state.player.mapId];
  if (!currentMap?.interactables?.length) return null;

  for (const item of currentMap.interactables) {
    if (!item.trainer || !item.facing || !item.sightRange) continue;
    if (state.storyFlags[`defeated_trainer:${item.id}`]) continue;

    const delta = DIRECTION_DELTAS[item.facing];
    for (let step = 1; step <= item.sightRange; step++) {
      const checkPos: GridPosition = {
        x: item.pos.x + delta.x * step,
        z: item.pos.z + delta.z * step,
      };
      if (!isWalkable(currentMap, checkPos)) break;
      if (checkPos.x === state.player.pos.x && checkPos.z === state.player.pos.z) {
        return item;
      }
    }
  }

  return null;
}

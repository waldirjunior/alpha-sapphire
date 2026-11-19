import type { Direction, GameState, GridPosition, Interactable, MapDefinition } from './types';
import { DIRECTION_DELTAS, stepPosition, stepWarp } from './warps';
import { boundaryTarget, stepBoundary } from './boundaries';
import type { BoundaryLink } from './types';
import { lateralLedgeLanding, southLedgeLanding } from './ledges';
import { groundHeight, selectGroundHeight } from './groundHeight';
import { createInitialAmxFlags } from './initialAmxFlags';

function playerGroundReference(state: GameState, map: MapDefinition): number {
  return state.player.groundY ?? groundHeight(map, state.player.pos) ?? 0;
}

function positionPlayerOnFloor(player: GameState['player'], map: MapDefinition, pos: GridPosition, referenceY: number): GameState['player'] {
  const groundY = selectGroundHeight(map, pos, referenceY);
  return { ...player, groundY: groundY ?? undefined };
}

function crossBoundary(state: GameState, direction: Direction, maps: Record<string, MapDefinition>, link: BoundaryLink): GameState {
  const target = maps[link.targetMapId];
  const pos = boundaryTarget(state.player.pos, link);
  const source = maps[state.player.mapId];
  if (!target || !source || !pos || !isWalkable(source, state.player.pos) || !isWalkable(target, pos)) {
    return { ...state, player: { ...state.player, facing: direction } };
  }
  const referenceY = playerGroundReference(state, source);
  const player = positionPlayerOnFloor({ ...state.player, mapId: target.id, pos, facing: direction }, target, pos, referenceY);
  return { ...state, player };
}

export function createInitialState(
  startMapId = 'littleroot_town',
  maps?: Record<string, MapDefinition>
): GameState {
  const spawn = maps?.[startMapId]?.spawnPos;
  const map = maps?.[startMapId];
  const pos = spawn ? { ...spawn } : { x: 5, z: 5 };
  const groundY = map ? groundHeight(map, pos) : null;
  return {
    player: {
      id: 'local-player',
      mapId: startMapId,
      pos,
      facing: 'down',
      ...(groundY === null ? {} : { groundY }),
    },
    storyFlags: {
      intro_completed: false,
      starter_chosen: false,
    },
    romEvents: { flags: createInitialAmxFlags(), vars: {} },
  };
}

export function isWalkable(map: MapDefinition, pos: GridPosition): boolean {
  if (pos.x < 0 || pos.z < 0 || pos.x >= map.width || pos.z >= map.height) {
    return false;
  }
  return map.collisions[pos.z]?.[pos.x] === 0 &&
    !isSurfTile(map, pos) &&
    !map.npcs?.some(npc => npc.visible !== false && npc.pos.x === pos.x && npc.pos.z === pos.z);
}

function isSurfTile(map: MapDefinition, pos: GridPosition): boolean {
  if (map.surfTileKeys) return map.surfTileKeys.has(`${pos.x},${pos.z}`);
  return map.surfTiles?.some(tile => tile.x === pos.x && tile.z === pos.z) ?? false;
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

  const warp = stepWarp(state, direction, currentMap);
  const referenceY = playerGroundReference(state, currentMap);
  const ledgeLanding = warp ? undefined :
    southLedgeLanding(currentMap, state.player.pos, direction) ?? lateralLedgeLanding(currentMap, state.player.pos, direction);
  const nextPos = ledgeLanding ?? stepPosition(state.player.pos, direction);
  const boundary = !warp && stepBoundary(state.player.pos, direction, currentMap);
  if (boundary) return crossBoundary(state, direction, maps, boundary);

  if ((!warp && !isWalkable(currentMap, nextPos)) || (warp && !maps[warp.targetMapId])) {
    return {
      ...state,
      player: { ...state.player, facing: direction },
    };
  }

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
    const targetMap = maps[warp.targetMapId];
    const targetPos = { ...warp.targetPos };
    const player = positionPlayerOnFloor({ ...state.player, mapId: targetMap.id,
      pos: targetPos, facing: warp.faceDirection ?? direction }, targetMap, targetPos, referenceY);
    return { ...state, player };
  }

  return {
    ...state,
    player: {
      ...positionPlayerOnFloor(state.player, currentMap, nextPos, referenceY),
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

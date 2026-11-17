import { createInitialState, movePlayer } from './gameState';
import type { Direction, GameState, MapDefinition } from './types';

export interface RoomPlayer {
  playerId: string;
  displayName: string;
  state: GameState;
}

export interface RoomState {
  roomId: string;
  defaultMapId: string;
  players: Record<string, RoomPlayer>;
}

export function createRoom(roomId: string, defaultMapId = 'littleroot_town'): RoomState {
  if (!roomId.trim()) {
    throw new Error(`roomId inválido: "${roomId}" (esperado identificador não vazio).`);
  }
  return {
    roomId,
    defaultMapId,
    players: {},
  };
}

export function joinRoom(
  room: RoomState,
  playerId: string,
  displayName: string,
  maps: Record<string, MapDefinition>
): RoomState {
  const initial = createInitialState(room.defaultMapId, maps);
  const playerState: GameState = {
    ...initial,
    player: { ...initial.player, id: playerId },
  };
  return {
    ...room,
    players: {
      ...room.players,
      [playerId]: {
        playerId,
        displayName,
        state: playerState,
      },
    },
  };
}

export function leaveRoom(room: RoomState, playerId: string): RoomState {
  if (!room.players[playerId]) return room;
  const { [playerId]: _removed, ...rest } = room.players;
  return {
    ...room,
    players: rest,
  };
}

export function applyRoomMove(
  room: RoomState,
  playerId: string,
  direction: Direction,
  maps: Record<string, MapDefinition>
): RoomState {
  const member = room.players[playerId];
  if (!member) return room;

  const nextState = movePlayer(member.state, direction, maps);
  return {
    ...room,
    players: {
      ...room.players,
      [playerId]: {
        ...member,
        state: nextState,
      },
    },
  };
}

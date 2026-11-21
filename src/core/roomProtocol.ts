import { applyRoomMove, createRoom, joinRoom, leaveRoom } from './room';
import type { RoomPlayer, RoomState } from './room';
import type { Direction, MapDefinition } from './types';

export type RoomClientMessage =
  | { type: 'join'; roomId: string; displayName: string; mapId?: string }
  | { type: 'move'; direction: Direction }
  | { type: 'leave' }
  | { type: 'ping'; nonce?: string | number };

export type RoomServerMessage =
  | { type: 'joined'; roomId: string; playerId: string }
  | { type: 'snapshot'; roomId: string; players: RoomPlayer[] }
  | { type: 'player_joined'; roomId: string; player: RoomPlayer }
  | { type: 'player_moved'; roomId: string; player: RoomPlayer }
  | { type: 'player_left'; roomId: string; playerId: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong'; nonce?: string | number };

export interface RoomMessageResult {
  room: RoomState | null;
  broadcast: RoomServerMessage[];
  direct: RoomServerMessage[];
}

export interface RoomRegistry {
  rooms: Record<string, RoomState>;
  playerRooms: Record<string, string>;
}

export interface RoomSummary {
  roomId: string;
  mapId: string;
  playerCount: number;
}

export interface RoomRegistryResult {
  registry: RoomRegistry;
  broadcast: RoomServerMessage[];
  direct: RoomServerMessage[];
}

const DEFAULT_MAP_ID = 'zone_0006';
const own = (record: object, key: string): boolean => Object.hasOwn(record, key);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireKeys(record: Record<string, unknown>, allowed: readonly string[]): void {
  const unexpected = Object.keys(record).find((key) => !allowed.includes(key));
  if (unexpected) throw new Error(`campo inesperado: ${unexpected}`);
}

function requireText(record: Record<string, unknown>, field: string, maxLength: number): string {
  const value = record[field];
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`${field} inválido: esperado texto não vazio de até ${maxLength} caracteres.`);
  }
  return value.trim();
}

function parseRecord(value: unknown): RoomClientMessage {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error('Mensagem inválida: esperado objeto com campo type.');
  }
  if (value.type === 'join') return parseJoin(value);
  if (value.type === 'move') return parseMove(value);
  if (value.type === 'leave') return parseLeave(value);
  if (value.type === 'ping') return parsePing(value);
  throw new Error(`type inválido: ${value.type} (esperado join, move, leave ou ping).`);
}

function parseJoin(record: Record<string, unknown>): RoomClientMessage {
  requireKeys(record, ['type', 'roomId', 'displayName', 'mapId']);
  const roomId = requireText(record, 'roomId', 64);
  const displayName = requireText(record, 'displayName', 64);
  if (record.mapId === undefined) return { type: 'join', roomId, displayName };
  return { type: 'join', roomId, displayName, mapId: requireText(record, 'mapId', 64) };
}

function parseMove(record: Record<string, unknown>): RoomClientMessage {
  requireKeys(record, ['type', 'direction']);
  const direction = record.direction;
  if (direction === 'up' || direction === 'down' || direction === 'left' || direction === 'right') {
    return { type: 'move', direction };
  }
  throw new Error(`direction inválida: ${String(direction)} (esperado up, down, left ou right).`);
}

function parseLeave(record: Record<string, unknown>): RoomClientMessage {
  requireKeys(record, ['type']);
  return { type: 'leave' };
}

function parsePing(record: Record<string, unknown>): RoomClientMessage {
  requireKeys(record, ['type', 'nonce']);
  if (record.nonce === undefined) return { type: 'ping' };
  if (typeof record.nonce === 'string' && record.nonce.length <= 64) {
    return { type: 'ping', nonce: record.nonce };
  }
  if (typeof record.nonce === 'number' && Number.isFinite(record.nonce)) {
    return { type: 'ping', nonce: record.nonce };
  }
  throw new Error('nonce inválido: esperado texto de até 64 caracteres ou número finito.');
}

export function parseRoomClientMessage(raw: string): RoomClientMessage {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('JSON inválido: esperado uma mensagem de sala.');
  }
  return parseRecord(value);
}

export function serializeRoomMessage(message: RoomServerMessage): string {
  return JSON.stringify(message);
}

function errorResult(room: RoomState | null, code: string, message: string): RoomMessageResult {
  return { room, broadcast: [], direct: [{ type: 'error', code, message }] };
}

function applyJoin(
  room: RoomState | null,
  playerId: string,
  message: Extract<RoomClientMessage, { type: 'join' }>,
  maps: Record<string, MapDefinition>
): RoomMessageResult {
  if (room && room.roomId !== message.roomId) {
    return errorResult(room, 'ROOM_MISMATCH', `Sala ${room.roomId} já está vinculada a esta conexão.`);
  }
  const mapId = message.mapId ?? room?.defaultMapId ?? DEFAULT_MAP_ID;
  if (!own(maps, mapId)) return errorResult(room, 'UNKNOWN_MAP', `Mapa ${mapId} não foi carregado no servidor.`);
  if (room && message.mapId && message.mapId !== room.defaultMapId) {
    return errorResult(room, 'ROOM_MAP_MISMATCH', `Sala ${room.roomId} usa o mapa ${room.defaultMapId}.`);
  }
  if (room && own(room.players, playerId)) return errorResult(room, 'ALREADY_JOINED', `Jogador ${playerId} já entrou na sala.`);

  const targetRoom = room ?? createRoom(message.roomId, mapId);
  const joined = joinRoom(targetRoom, playerId, message.displayName, maps);
  const player = joined.players[playerId];
  if (!player) return errorResult(room, 'JOIN_FAILED', `Jogador ${playerId} não foi adicionado à sala.`);
  return {
    room: joined,
    broadcast: room && Object.keys(room.players).length > 0
      ? [{ type: 'player_joined', roomId: room.roomId, player }]
      : [],
    direct: [
      { type: 'joined', roomId: joined.roomId, playerId },
      { type: 'snapshot', roomId: joined.roomId, players: Object.values(joined.players) },
    ],
  };
}

export function applyRoomClientMessage(
  room: RoomState | null,
  playerId: string,
  message: RoomClientMessage,
  maps: Record<string, MapDefinition>
): RoomMessageResult {
  if (message.type === 'ping') {
    return { room, broadcast: [], direct: [{ type: 'pong', ...(message.nonce === undefined ? {} : { nonce: message.nonce }) }] };
  }
  if (message.type === 'join') return applyJoin(room, playerId, message, maps);
  const player = room && own(room.players, playerId) ? room.players[playerId] : undefined;
  if (!room || !player) return errorResult(room, 'NOT_JOINED', `Jogador ${playerId} não está em uma sala.`);
  if (message.type === 'leave') {
    return {
      room: leaveRoom(room, playerId),
      broadcast: [{ type: 'player_left', roomId: room.roomId, playerId }],
      direct: [],
    };
  }
  const moved = applyRoomMove(room, playerId, message.direction, maps);
  const updated = moved.players[playerId];
  if (!updated) return errorResult(room, 'MOVE_FAILED', `Jogador ${playerId} sumiu durante o movimento.`);
  return {
    room: moved,
    broadcast: [{ type: 'player_moved', roomId: room.roomId, player: updated }],
    direct: [],
  };
}

export function createRoomRegistry(): RoomRegistry {
  return { rooms: {}, playerRooms: {} };
}

function registryError(registry: RoomRegistry, code: string, message: string): RoomRegistryResult {
  return { registry, broadcast: [], direct: [{ type: 'error', code, message }] };
}

function updateRegistry(
  registry: RoomRegistry,
  playerId: string,
  roomId: string,
  result: RoomMessageResult
): RoomRegistryResult {
  const room = result.room;
  if (!room) return registryError(registry, 'ROOM_MISSING', `Sala ${roomId} não existe após a mensagem.`);
  const rooms = { ...registry.rooms, [roomId]: room };
  const playerRooms = { ...registry.playerRooms, [playerId]: roomId };
  if (result.direct.some((message) => message.type === 'error')) return registryError(registry, 'MESSAGE_REJECTED', 'Mensagem rejeitada.');
  return { registry: { rooms, playerRooms }, broadcast: result.broadcast, direct: result.direct };
}

function handleJoin(
  registry: RoomRegistry,
  playerId: string,
  message: Extract<RoomClientMessage, { type: 'join' }>,
  maps: Record<string, MapDefinition>
): RoomRegistryResult {
  if (own(registry.playerRooms, playerId)) {
    return registryError(registry, 'ALREADY_JOINED', `Jogador ${playerId} já está na sala ${registry.playerRooms[playerId]}.`);
  }
  const room = own(registry.rooms, message.roomId) ? registry.rooms[message.roomId] ?? null : null;
  const result = applyRoomClientMessage(room, playerId, message, maps);
  if (result.direct.some((item) => item.type === 'error')) {
    return { registry, broadcast: [], direct: result.direct };
  }
  return updateRegistry(registry, playerId, message.roomId, result);
}

export function handleRoomMessage(
  registry: RoomRegistry,
  playerId: string,
  message: RoomClientMessage,
  maps: Record<string, MapDefinition>
): RoomRegistryResult {
  if (message.type === 'ping') {
    return { registry, ...applyRoomClientMessage(null, playerId, message, maps) };
  }
  if (message.type === 'join') return handleJoin(registry, playerId, message, maps);
  if (!own(registry.playerRooms, playerId)) {
    return registryError(registry, 'NOT_JOINED', `Jogador ${playerId} não está em uma sala.`);
  }
  const roomId = registry.playerRooms[playerId] ?? '';
  const room = own(registry.rooms, roomId) ? registry.rooms[roomId] ?? null : null;
  const result = applyRoomClientMessage(room, playerId, message, maps);
  if (result.direct.some((item) => item.type === 'error')) return { registry, broadcast: [], direct: result.direct };
  if (message.type !== 'leave') return updateRegistry(registry, playerId, roomId, result);
  const { [playerId]: _removed, ...playerRooms } = registry.playerRooms;
  const updatedRoom = result.room;
  if (updatedRoom && Object.keys(updatedRoom.players).length > 0) {
    return {
      registry: { rooms: { ...registry.rooms, [roomId]: updatedRoom }, playerRooms },
      broadcast: result.broadcast,
      direct: result.direct,
    };
  }
  const { [roomId]: _emptyRoom, ...rooms } = registry.rooms;
  return { registry: { rooms, playerRooms }, broadcast: result.broadcast, direct: result.direct };
}

export function disconnectRoomPlayer(registry: RoomRegistry, playerId: string): RoomRegistryResult {
  if (!own(registry.playerRooms, playerId)) return { registry, broadcast: [], direct: [] };
  const roomId = registry.playerRooms[playerId] ?? '';
  const room = own(registry.rooms, roomId) ? registry.rooms[roomId] : undefined;
  const { [playerId]: _removed, ...playerRooms } = registry.playerRooms;
  if (!room || !own(room.players, playerId)) return { registry: { rooms: registry.rooms, playerRooms }, broadcast: [], direct: [] };
  const updated = leaveRoom(room, playerId);
  const broadcast: RoomServerMessage[] = [{ type: 'player_left', roomId, playerId }];
  if (Object.keys(updated.players).length > 0) {
    return { registry: { rooms: { ...registry.rooms, [roomId]: updated }, playerRooms }, broadcast, direct: [] };
  }
  const { [roomId]: _emptyRoom, ...rooms } = registry.rooms;
  return { registry: { rooms, playerRooms }, broadcast, direct: [] };
}

export function listRooms(registry: RoomRegistry): RoomSummary[] {
  return Object.values(registry.rooms)
    .map(({ roomId, defaultMapId, players }) => ({
      roomId,
      mapId: defaultMapId,
      playerCount: Object.keys(players).length,
    }))
    .sort((left, right) => left.roomId.localeCompare(right.roomId));
}

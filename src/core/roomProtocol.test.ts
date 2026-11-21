import { describe, expect, it } from 'vitest';
import {
  applyRoomClientMessage,
  createRoomRegistry,
  disconnectRoomPlayer,
  handleRoomMessage,
  listRooms,
  parseRoomClientMessage,
  serializeRoomMessage,
  type RoomClientMessage,
} from './roomProtocol';
import type { MapDefinition } from './types';

const MAPS: Record<string, MapDefinition> = {
  test_map: {
    id: 'test_map',
    name: 'Test Map',
    width: 5,
    height: 5,
    spawnPos: { x: 2, z: 2 },
    collisions: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0)),
    warps: [],
  },
  warp_start: {
    id: 'warp_start',
    name: 'Warp Start',
    width: 5,
    height: 5,
    spawnPos: { x: 2, z: 2 },
    collisions: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0)),
    warps: [{ from: { x: 2, z: 1 }, targetMapId: 'warp_dest', targetPos: { x: 3, z: 3 } }],
  },
  warp_dest: {
    id: 'warp_dest',
    name: 'Warp Destination',
    width: 5,
    height: 5,
    spawnPos: { x: 1, z: 1 },
    collisions: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0)),
    warps: [],
  },
};

describe('room message protocol', () => {
  it('parses supported messages and rejects malformed or extra fields', () => {
    expect(parseRoomClientMessage('{"type":"join","roomId":"hoenn","displayName":"May","mapId":"test_map"}'))
      .toEqual({ type: 'join', roomId: 'hoenn', displayName: 'May', mapId: 'test_map' });
    expect(parseRoomClientMessage('{"type":"ping","nonce":7}')).toEqual({ type: 'ping', nonce: 7 });
    expect(() => parseRoomClientMessage('{')).toThrow(/JSON inválido/);
    expect(() => parseRoomClientMessage('{"type":"move","direction":"diagonal"}')).toThrow(/direction/);
    expect(() => parseRoomClientMessage('{"type":"leave","roomId":"hoenn"}')).toThrow(/campo inesperado/);
    expect(() => parseRoomClientMessage('null')).toThrow(/objeto/);
    expect(() => parseRoomClientMessage('{"type":"teleport"}')).toThrow(/type inválido/);
    expect(() => parseRoomClientMessage('{"type":"join","roomId":" ","displayName":"May"}')).toThrow(/roomId/);
    expect(() => parseRoomClientMessage('{"type":"ping","nonce":null}')).toThrow(/nonce/);
  });

  it('serializes server messages as JSON', () => {
    const message = { type: 'pong', nonce: 'n-1' } as const;
    expect(JSON.parse(serializeRoomMessage(message))).toEqual(message);
  });

  it('joins multiple rooms, sends a snapshot, and broadcasts authoritative moves', () => {
    let registry = createRoomRegistry();
    const firstJoin = handleRoomMessage(registry, 'p1', {
      type: 'join', roomId: 'room-a', displayName: 'May', mapId: 'test_map',
    }, MAPS);
    registry = firstJoin.registry;
    expect(firstJoin.direct.map((message) => message.type)).toEqual(['joined', 'snapshot']);
    expect(firstJoin.direct[1]).toMatchObject({ type: 'snapshot', players: [{ playerId: 'p1' }] });

    const secondJoin = handleRoomMessage(registry, 'p2', {
      type: 'join', roomId: 'room-a', displayName: 'Brendan',
    }, MAPS);
    registry = secondJoin.registry;
    expect(secondJoin.broadcast).toMatchObject([{ type: 'player_joined', player: { playerId: 'p2' } }]);

    const move = handleRoomMessage(registry, 'p1', { type: 'move', direction: 'up' }, MAPS);
    registry = move.registry;
    expect(move.broadcast).toMatchObject([{ type: 'player_moved', player: { playerId: 'p1', state: { player: { pos: { x: 2, z: 1 } } } } }]);
    expect(registry.rooms['room-a']?.players.p2?.state.player.pos).toEqual({ x: 2, z: 2 });

    const otherRoom = handleRoomMessage(registry, 'p3', {
      type: 'join', roomId: 'room-b', displayName: 'Wally', mapId: 'test_map',
    }, MAPS);
    expect(listRooms(otherRoom.registry)).toEqual([
      { roomId: 'room-a', mapId: 'test_map', playerCount: 2 },
      { roomId: 'room-b', mapId: 'test_map', playerCount: 1 },
    ]);

    const warpJoin = handleRoomMessage(otherRoom.registry, 'p4', {
      type: 'join', roomId: 'warp-room', displayName: 'Roxanne', mapId: 'warp_start',
    }, MAPS);
    const warped = handleRoomMessage(warpJoin.registry, 'p4', { type: 'move', direction: 'up' }, MAPS);
    expect(warped.broadcast[0]).toMatchObject({
      type: 'player_moved',
      player: { playerId: 'p4', state: { player: { mapId: 'warp_dest', pos: { x: 3, z: 3 } } } },
    });
  });

  it('rejects duplicate membership, unknown maps, and movement outside a room', () => {
    const registry = createRoomRegistry();
    const joined = handleRoomMessage(registry, 'p1', {
      type: 'join', roomId: 'room-a', displayName: 'May', mapId: 'test_map',
    }, MAPS).registry;
    const duplicate = handleRoomMessage(joined, 'p1', {
      type: 'join', roomId: 'room-b', displayName: 'May', mapId: 'test_map',
    }, MAPS);
    expect(duplicate.direct[0]).toMatchObject({ type: 'error', code: 'ALREADY_JOINED' });
    expect(duplicate.registry).toBe(joined);
    const mapMismatch = handleRoomMessage(joined, 'p2', {
      type: 'join', roomId: 'room-a', displayName: 'Wally', mapId: 'warp_start',
    }, MAPS);
    expect(mapMismatch.direct[0]).toMatchObject({ type: 'error', code: 'ROOM_MAP_MISMATCH' });

    const unknownMap = handleRoomMessage(registry, 'p2', {
      type: 'join', roomId: 'room-c', displayName: 'Wally', mapId: 'missing',
    }, MAPS);
    expect(unknownMap.direct[0]).toMatchObject({ type: 'error', code: 'UNKNOWN_MAP' });
    expect(unknownMap.registry.rooms).toEqual({});

    const notJoined = handleRoomMessage(registry, 'p2', { type: 'move', direction: 'up' }, MAPS);
    expect(notJoined.direct[0]).toMatchObject({ type: 'error', code: 'NOT_JOINED' });
  });

  it('handles ping, explicit leave, and disconnect with immutable registry updates', () => {
    const ping = handleRoomMessage(createRoomRegistry(), 'p1', { type: 'ping', nonce: 'echo' }, MAPS);
    expect(ping.direct).toEqual([{ type: 'pong', nonce: 'echo' }]);

    const joined = handleRoomMessage(createRoomRegistry(), 'p1', {
      type: 'join', roomId: 'room-a', displayName: 'May', mapId: 'test_map',
    }, MAPS).registry;
    const left = handleRoomMessage(joined, 'p1', { type: 'leave' }, MAPS);
    expect(left.broadcast).toEqual([{ type: 'player_left', roomId: 'room-a', playerId: 'p1' }]);
    expect(listRooms(left.registry)).toEqual([]);
    expect(listRooms(joined)).toHaveLength(1);

    const twoPlayers = handleRoomMessage(joined, 'p2', {
      type: 'join', roomId: 'room-a', displayName: 'Brendan',
    }, MAPS).registry;
    const memberLeft = handleRoomMessage(twoPlayers, 'p1', { type: 'leave' }, MAPS);
    expect(listRooms(memberLeft.registry)).toEqual([{ roomId: 'room-a', mapId: 'test_map', playerCount: 1 }]);
    const memberDisconnected = disconnectRoomPlayer(memberLeft.registry, 'p2');
    expect(listRooms(memberDisconnected.registry)).toEqual([]);

    const joinedAgain = handleRoomMessage(createRoomRegistry(), 'p1', {
      type: 'join', roomId: 'room-a', displayName: 'May', mapId: 'test_map',
    }, MAPS).registry;
    const disconnected = disconnectRoomPlayer(joinedAgain, 'p1');
    expect(disconnected.broadcast).toEqual([{ type: 'player_left', roomId: 'room-a', playerId: 'p1' }]);
    expect(listRooms(disconnected.registry)).toEqual([]);
    expect(disconnectRoomPlayer(disconnected.registry, 'missing').registry).toBe(disconnected.registry);
  });

  it('keeps the single-room protocol helper immutable and rejects a mismatched room', () => {
    const joinMessage: RoomClientMessage = {
      type: 'join', roomId: 'room-a', displayName: 'May', mapId: 'test_map',
    };
    const joined = applyRoomClientMessage(null, 'p1', joinMessage, MAPS);
    expect(joined.room?.players.p1?.state.player.mapId).toBe('test_map');
    expect(joined.broadcast).toEqual([]);
    const mismatch = applyRoomClientMessage(joined.room, 'p1', {
      type: 'join', roomId: 'room-b', displayName: 'May', mapId: 'test_map',
    }, MAPS);
    expect(mismatch.direct[0]).toMatchObject({ type: 'error', code: 'ROOM_MISMATCH' });
    expect(mismatch.room).toBe(joined.room);
    expect(applyRoomClientMessage(null, 'p1', { type: 'ping' }, MAPS).direct).toEqual([{ type: 'pong' }]);
    expect(applyRoomClientMessage(null, 'p1', { type: 'move', direction: 'down' }, MAPS).direct[0])
      .toMatchObject({ type: 'error', code: 'NOT_JOINED' });
    expect(applyRoomClientMessage(joined.room, 'p1', { type: 'leave' }, MAPS).room?.players)
      .toEqual({});
  });
});

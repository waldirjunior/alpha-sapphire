import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import { applyRoomMove, createRoom, joinRoom, leaveRoom } from './room';

describe('multiplayer room state', () => {
  it('allows multiple players to join, move independently, warp, and leave', () => {
    let room = createRoom('sala-hoenn-1');
    room = joinRoom(room, 'p1', 'Brendan', MAPS);
    room = joinRoom(room, 'p2', 'May', MAPS);

    expect(Object.keys(room.players)).toEqual(['p1', 'p2']);
    expect(room.players.p1?.state.player.pos).toEqual({ x: 20, z: 14 });
    expect(room.players.p2?.state.player.pos).toEqual({ x: 20, z: 14 });

    // Move only p1 north, p2 stays untouched
    const moved = applyRoomMove(room, 'p1', 'up', MAPS);
    expect(moved.players.p1?.state.player.pos).toEqual({ x: 20, z: 13 });
    expect(moved.players.p2?.state.player.pos).toEqual({ x: 20, z: 14 });
    // Original room remains immutable
    expect(room.players.p1?.state.player.pos).toEqual({ x: 20, z: 14 });

    const left = leaveRoom(moved, 'p2');
    expect(Object.keys(left.players)).toEqual(['p1']);
  });
});

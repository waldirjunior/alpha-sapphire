import { afterEach, describe, expect, it } from 'vitest';
import { adaptZoneMap, type ZoneMapSource } from '../data/maps_v2/adapter';
import littlerootZone from '../data/maps_v2/0006.json';
import { createMultiplayerServer } from './multiplayerServer';

const MAPS = { zone_0006: adaptZoneMap(littlerootZone as ZoneMapSource) };

interface ReceivedMessage {
  type: string;
  roomId?: string;
  playerId?: string;
  direction?: string;
  code?: string;
  player?: { playerId: string; state: { player: { mapId: string; pos: { x: number; z: number } } } };
}

class MessageQueue {
  private readonly messages: ReceivedMessage[] = [];
  private readonly waiters: Array<{
    type: string;
    resolve: (message: ReceivedMessage) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as ReceivedMessage;
      const index = this.waiters.findIndex((waiter) => waiter.type === message.type);
      const waiter = index < 0 ? undefined : this.waiters.splice(index, 1)[0];
      if (!waiter) return this.messages.push(message);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    });
  }

  async next(type: string): Promise<ReceivedMessage> {
    const index = this.messages.findIndex((message) => message.type === type);
    if (index >= 0) return this.messages.splice(index, 1)[0]!;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiterIndex = this.waiters.findIndex((waiter) => waiter.type === type);
        if (waiterIndex >= 0) this.waiters.splice(waiterIndex, 1);
        reject(new Error(`Timeout esperando ${type}`));
      }, 2_000);
      this.waiters.push({ type, resolve, timeout });
    });
  }
}

async function connect(port: number): Promise<{ socket: WebSocket; messages: MessageQueue }> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error('WebSocket connection failed')), { once: true });
  });
  return { socket, messages: new MessageQueue(socket) };
}

async function join(socket: WebSocket, messages: MessageQueue, roomId: string): Promise<void> {
  socket.send(JSON.stringify({ type: 'join', roomId, displayName: roomId, mapId: 'zone_0006' }));
  await messages.next('joined');
  await messages.next('snapshot');
}

describe('authoritative multiplayer WebSocket server', () => {
  let closeServer: (() => Promise<void>) | undefined;
  let clients: WebSocket[] = [];

  afterEach(async () => {
    for (const client of clients) if (client.readyState === WebSocket.OPEN) client.close();
    clients = [];
    await closeServer?.();
    closeServer = undefined;
  });

  it('synchronizes two clients, rejects invalid input, and cleans disconnects', async () => {
    const instance = createMultiplayerServer({ maps: MAPS });
    closeServer = instance.close;
    const port = await instance.listen(0, '127.0.0.1');
    const first = await connect(port);
    clients.push(first.socket);
    await join(first.socket, first.messages, 'hoenn-room');

    const second = await connect(port);
    clients.push(second.socket);
    await join(second.socket, second.messages, 'hoenn-room');
    await first.messages.next('player_joined');

    first.socket.send(JSON.stringify({ type: 'move', direction: 'down' }));
    expect((await first.messages.next('player_moved')).player?.state.player.pos).toEqual({ x: 19, z: 1 });
    expect((await second.messages.next('player_moved')).player?.state.player.pos).toEqual({ x: 19, z: 1 });

    second.socket.send(JSON.stringify({ type: 'move', direction: 'right' }));
    expect((await first.messages.next('player_moved')).player?.state.player.pos).toEqual({ x: 20, z: 0 });
    expect((await second.messages.next('player_moved')).player?.state.player.pos).toEqual({ x: 20, z: 0 });

    first.socket.send('{"type":"move","direction":"diagonal"}');
    expect(await first.messages.next('error')).toMatchObject({ type: 'error', code: 'INVALID_MESSAGE' });

    first.socket.close();
    await second.messages.next('player_left');
    expect(instance.rooms()).toEqual([{ roomId: 'hoenn-room', mapId: 'zone_0006', playerCount: 1 }]);
    const disconnected = new Promise<void>((resolve) => second.socket.addEventListener('close', () => resolve(), { once: true }));
    second.socket.close();
    await disconnected;
    expect(instance.rooms()).toEqual([]);
  });
});

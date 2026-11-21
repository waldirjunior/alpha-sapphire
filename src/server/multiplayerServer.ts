import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  createRoomRegistry,
  disconnectRoomPlayer,
  handleRoomMessage,
  listRooms,
  parseRoomClientMessage,
  serializeRoomMessage,
  type RoomRegistry,
  type RoomRegistryResult,
  type RoomServerMessage,
  type RoomSummary,
} from '../core/roomProtocol';
import type { MapDefinition } from '../core/types';

const MAX_MESSAGE_BYTES = 65_536;
const SOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

interface ClientPeer {
  playerId: string;
  socket: Duplex;
  buffer: Buffer;
  disconnected: boolean;
}

export interface MultiplayerServerOptions {
  maps: Record<string, MapDefinition>;
}

export interface MultiplayerServer {
  listen(port?: number, host?: string): Promise<number>;
  close(): Promise<void>;
  rooms(): RoomSummary[];
}

function writeHttp(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(payload);
}

function handleHttp(request: IncomingMessage, response: ServerResponse, rooms: () => RoomSummary[]): void {
  if (request.method === 'GET' && request.url === '/health') {
    writeHttp(response, 200, { status: 'ok' });
    return;
  }
  if (request.method === 'GET' && request.url === '/rooms') {
    writeHttp(response, 200, rooms());
    return;
  }
  writeHttp(response, 404, { error: 'not found' });
}

function frame(opcode: number, payload = Buffer.alloc(0)): Buffer {
  const length = payload.length;
  const header = length < 126 ? Buffer.from([0x80 | opcode, length])
    : length < 65_536
      ? Buffer.from([0x80 | opcode, 126, length >> 8, length & 0xff])
      : Buffer.from([0x80 | opcode, 127, 0, 0, 0, 0, 0, 0, length >> 24, length >> 16, length >> 8, length & 0xff]);
  return Buffer.concat([header, payload]);
}

function sendText(peer: ClientPeer, message: RoomServerMessage): void {
  if (!peer.disconnected) peer.socket.write(frame(0x1, Buffer.from(serializeRoomMessage(message))));
}

function closePeer(peer: ClientPeer, code: number): void {
  if (peer.disconnected) return;
  const payload = Buffer.alloc(2);
  payload.writeUInt16BE(code);
  peer.socket.end(frame(0x8, payload));
}

function handshake(request: IncomingMessage, socket: Duplex): boolean {
  const key = request.headers['sec-websocket-key'];
  const upgrade = request.headers.upgrade?.toLowerCase();
  if (typeof key !== 'string' || upgrade !== 'websocket' || request.headers['sec-websocket-version'] !== '13') return false;
  const accept = createHash('sha1').update(key + SOCKET_GUID).digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n',
  ].join('\r\n'));
  return true;
}

function readFrame(peer: ClientPeer, chunk: Buffer, onMessage: (text: string) => void, onClose: () => void): void {
  peer.buffer = Buffer.concat([peer.buffer, chunk]);
  while (peer.buffer.length >= 2) {
    const first = peer.buffer[0] ?? 0;
    const second = peer.buffer[1] ?? 0;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let headerLength = 2;
    if ((first & 0x70) !== 0 || (first & 0x80) === 0 || !masked) return closePeer(peer, 1002);
    if (length === 126) {
      if (peer.buffer.length < 4) return;
      length = peer.buffer.readUInt16BE(2);
      headerLength = 4;
    } else if (length === 127) {
      if (peer.buffer.length < 10) return;
      const extended = peer.buffer.readBigUInt64BE(2);
      if (extended > BigInt(MAX_MESSAGE_BYTES)) return closePeer(peer, 1009);
      length = Number(extended);
      headerLength = 10;
    }
    if (length > MAX_MESSAGE_BYTES) return closePeer(peer, 1009);
    const frameLength = headerLength + 4 + length;
    if (peer.buffer.length < frameLength) return;
    if (opcode >= 0x8 && (length > 125 || opcode === 0x8 && length === 1)) return closePeer(peer, 1002);
    const maskOffset = headerLength;
    const payloadOffset = maskOffset + 4;
    const payload = Buffer.allocUnsafe(length);
    for (let index = 0; index < length; index += 1) {
      payload[index] = (peer.buffer[payloadOffset + index] ?? 0) ^ (peer.buffer[maskOffset + index % 4] ?? 0);
    }
    peer.buffer = peer.buffer.subarray(frameLength);
    if (opcode === 0x8) {
      onClose();
      peer.socket.end(frame(0x8, payload.length >= 2 ? payload : Buffer.from([0x03, 0xe8])));
      return;
    }
    if (opcode === 0x9) {
      peer.socket.write(frame(0xA, payload));
      continue;
    }
    if (opcode === 0xA) continue;
    if (opcode !== 0x1) return closePeer(peer, opcode === 0x2 ? 1003 : 1002);
    onMessage(payload.toString('utf8'));
  }
}

function messageRoomId(message: RoomServerMessage): string | null {
  return 'roomId' in message ? message.roomId : null;
}

export function createMultiplayerServer(options: MultiplayerServerOptions): MultiplayerServer {
  let registry: RoomRegistry = createRoomRegistry();
  let nextPlayerId = 1;
  const peers = new Set<ClientPeer>();
  const rooms = (): RoomSummary[] => listRooms(registry);

  const broadcast = (message: RoomServerMessage, origin?: ClientPeer): void => {
    const roomId = messageRoomId(message);
    if (!roomId) return;
    for (const peer of peers) {
      if (registry.playerRooms[peer.playerId] !== roomId) continue;
      if (message.type === 'player_joined' && peer === origin) continue;
      sendText(peer, message);
    }
  };

  const applyResult = (peer: ClientPeer, result: RoomRegistryResult): void => {
    registry = result.registry;
    for (const message of result.direct) sendText(peer, message);
    for (const message of result.broadcast) broadcast(message, peer);
  };

  const disconnect = (peer: ClientPeer): void => {
    if (peer.disconnected) return;
    peer.disconnected = true;
    peers.delete(peer);
    const result = disconnectRoomPlayer(registry, peer.playerId);
    registry = result.registry;
    for (const message of result.broadcast) broadcast(message);
  };

  const onClientMessage = (peer: ClientPeer, raw: string): void => {
    try {
      const message = parseRoomClientMessage(raw);
      applyResult(peer, handleRoomMessage(registry, peer.playerId, message, options.maps));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Mensagem inválida.';
      sendText(peer, { type: 'error', code: 'INVALID_MESSAGE', message: detail });
    }
  };

  const server: Server = createServer((request, response) => handleHttp(request, response, rooms));
  server.on('upgrade', (request, socket, head) => {
    if (!handshake(request, socket)) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      return;
    }
    const peer: ClientPeer = {
      playerId: `player-${nextPlayerId++}`,
      socket,
      buffer: Buffer.alloc(0),
      disconnected: false,
    };
    peers.add(peer);
    const onMessage = (text: string): void => onClientMessage(peer, text);
    const onClose = (): void => disconnect(peer);
    socket.on('data', (chunk: Buffer) => readFrame(peer, chunk, onMessage, onClose));
    socket.on('close', () => disconnect(peer));
    socket.on('end', () => disconnect(peer));
    socket.on('error', () => disconnect(peer));
    if (head.length > 0) readFrame(peer, head, onMessage, onClose);
  });

  return {
    rooms,
    listen(port = 3001, host = '127.0.0.1') {
      return new Promise<number>((resolve, reject) => {
        const failed = (error: Error): void => reject(error);
        server.once('error', failed);
        server.listen(port, host, () => {
          server.off('error', failed);
          const address = server.address();
          if (!address || typeof address === 'string') return reject(new Error('Servidor não informou uma porta TCP.'));
          resolve(address.port);
        });
      });
    },
    close() {
      for (const peer of peers) {
        disconnect(peer);
        closePeer(peer, 1001);
      }
      if (!server.listening) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    },
  };
}

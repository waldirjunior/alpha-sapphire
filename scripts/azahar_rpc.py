"""Cliente do servidor RPC do Azahar (UDP 45987): memória do processo emulado e captura de frame.

O emulador é o oráculo do jogo original (validacao-emulador/ADR-001). O protocolo é o da versão 2
do servidor: cabeçalho de quatro u32 (versão, id, tipo, tamanho) seguido dos dados.
"""

from __future__ import annotations

import random
import socket
import struct

PROTOCOL_VERSION = 2
PORT = 45987
HEADER = struct.Struct("<IIII")
MAX_DATA = 32 * 1024

READ_MEMORY = 1
WRITE_MEMORY = 2
PROCESS_LIST = 3
SET_GET_PROCESS = 4
TAKE_SCREENSHOT = 5
READ_SCREENSHOT = 6

SCREENSHOT_OK = 0
PROCESS_ENTRY = struct.Struct("<IQ8s")


class RpcError(RuntimeError):
    pass


def encode_request(request_id: int, kind: int, data: bytes) -> bytes:
    return HEADER.pack(PROTOCOL_VERSION, request_id, kind, len(data)) + data


def decode_reply(raw: bytes, request_id: int, kind: int) -> bytes | None:
    """Devolve os dados da resposta, ou None se o pacote não for a resposta deste pedido."""
    if len(raw) < HEADER.size:
        return None
    version, reply_id, reply_kind, size = HEADER.unpack_from(raw)
    body = raw[HEADER.size:]
    if (version, reply_id, reply_kind, size) != (PROTOCOL_VERSION, request_id, kind, len(body)):
        return None
    return body


def parse_process_list(body: bytes) -> dict[int, tuple[int, str]]:
    count = struct.unpack_from("<I", body)[0]
    entries = (PROCESS_ENTRY.unpack_from(body, 4 + index * PROCESS_ENTRY.size) for index in range(count))
    return {pid: (title_id, name.rstrip(b"\0").decode("ascii")) for pid, title_id, name in entries}


class AzaharRpc:
    def __init__(self, host: str = "127.0.0.1", port: int = PORT, timeout: float = 5.0, retries: int = 3):
        self._socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._socket.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4 * (MAX_DATA + HEADER.size))
        self._socket.settimeout(timeout)
        self._target = (host, port)
        self._retries = retries

    def close(self) -> None:
        self._socket.close()

    def _request(self, kind: int, data: bytes, attempts: int | None = None) -> bytes:
        request_id = random.getrandbits(32)
        for _ in range(attempts or self._retries):
            self._socket.sendto(encode_request(request_id, kind, data), self._target)
            try:
                while True:
                    body = decode_reply(self._socket.recv(MAX_DATA + HEADER.size), request_id, kind)
                    if body is not None:
                        return body
            except (socket.timeout, ConnectionRefusedError):
                continue
        raise RpcError(f"Azahar RPC sem resposta em {self._target[0]}:{self._target[1]} (pedido tipo {kind})")

    def processes(self) -> dict[int, tuple[int, str]]:
        return parse_process_list(self._request(PROCESS_LIST, struct.pack("<II", 0, 0x7FFFFFFF)))

    def select_process(self, process_id: int) -> None:
        self._request(SET_GET_PROCESS, struct.pack("<II", 1, process_id))

    def read(self, address: int, size: int) -> bytes:
        chunks = []
        while size > 0:
            chunk = self._request(READ_MEMORY, struct.pack("<II", address, min(size, MAX_DATA)))
            if not chunk:
                raise RpcError(f"Leitura vazia em 0x{address:08x}; processo selecionado não existe")
            chunks.append(chunk)
            address += len(chunk)
            size -= len(chunk)
        return b"".join(chunks)

    def write(self, address: int, data: bytes) -> None:
        for offset in range(0, len(data), MAX_DATA - 8):
            chunk = data[offset:offset + MAX_DATA - 8]
            self._request(WRITE_MEMORY, struct.pack("<II", address + offset, len(chunk)) + chunk)

    def screenshot_png(self) -> bytes:
        """PNG do próximo frame renderizado (as duas telas, na resolução interna)."""
        # Tirar a captura não é idempotente: uma tentativa só, com prazo maior.
        self._socket.settimeout(30.0)
        try:
            head = self._request(TAKE_SCREENSHOT, struct.pack("<II", 0, 0), attempts=1)
        finally:
            self._socket.settimeout(5.0)
        result, _width, _height, size = struct.unpack_from("<IIII", head)
        if result != SCREENSHOT_OK:
            raise RpcError(f"Captura recusada pelo Azahar (código {result})")
        png = bytearray()
        while len(png) < size:
            png += self._request(READ_SCREENSHOT, struct.pack("<II", len(png), min(size - len(png), MAX_DATA)))
        return bytes(png)

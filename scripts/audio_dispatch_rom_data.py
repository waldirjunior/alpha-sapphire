"""Small readers for the trainer GARCs used by the audio dispatch probe."""

from __future__ import annotations

import struct

if __package__:
    from scripts.unpack_garc import decompress_lz11
else:
    from unpack_garc import decompress_lz11


TRAINER_DATA_SIZE = 24
TRAINER_CLASS_SIZE = 16
TRAINER_CLASS_BGM_OFFSET = 0x0C


def require_range(blob: bytes, offset: int, size: int, context: str) -> None:
    if offset < 0 or size < 0 or offset + size > len(blob):
        raise ValueError(f"{context} fora do arquivo: {offset:#x}+{size:#x}/{len(blob):#x}")


def read_garc_entries(blob: bytes, *, decompress: bool = True) -> list[bytes | None]:
    if len(blob) < 28 or blob[:4] != b"CRAG":
        raise ValueError("GARC inválido: esperado cabeçalho CRAG de 28 bytes")
    _magic, header_size, _endian, _version, _chunks, data_offset, _file_size, _max_pad = struct.unpack_from(
        "<4sIHHIIII", blob, 0
    )
    require_range(blob, 0, header_size, "Cabeçalho GARC")
    require_range(blob, header_size, 12, "Cabeçalho FATO")
    fato_size = struct.unpack_from("<I", blob, header_size + 4)[0]
    if fato_size < 12:
        raise ValueError(f"Chunk FATO inválido: tamanho {fato_size}")
    fatb_offset = header_size + fato_size
    require_range(blob, fatb_offset, 12, "Cabeçalho FATB")
    _fatb_size, count = struct.unpack_from("<II", blob, fatb_offset + 4)
    cursor = fatb_offset + 12
    entries: list[bytes | None] = []
    for index in range(count):
        require_range(blob, cursor, 4, f"FATB entry {index} mask")
        mask = struct.unpack_from("<I", blob, cursor)[0]
        cursor += 4
        subfile_count = mask.bit_count()
        require_range(blob, cursor, subfile_count * 12, f"FATB entry {index} records")
        if subfile_count == 0:
            entries.append(None)
            continue
        if subfile_count != 1:
            raise ValueError(f"GARC entry {index} tem {subfile_count} subfiles; esperado 1 para tabela trainer")
        start, _end, length = struct.unpack_from("<III", blob, cursor)
        cursor += 12
        payload_offset = data_offset + start
        require_range(blob, payload_offset, length, f"GARC payload {index}")
        payload = blob[payload_offset : payload_offset + length]
        entries.append(decompress_entry(payload) if decompress else payload)
    return entries


def decompress_entry(payload: bytes) -> bytes:
    if payload[:1] != b"\x11":
        return payload
    try:
        return decompress_lz11(payload)
    except IndexError:
        return payload


def read_trainer_data_classes(entries: list[bytes | None]) -> list[dict[str, int]]:
    trainers = []
    for trainer_id, entry in enumerate(entries):
        if entry is None or not any(entry):
            continue
        if len(entry) != TRAINER_DATA_SIZE:
            raise ValueError(f"trdata[{trainer_id}] tem {len(entry)} bytes; esperado {TRAINER_DATA_SIZE}")
        if entry[7] == 0:
            continue
        trainers.append({"trainerId": trainer_id, "classId": struct.unpack_from("<H", entry, 2)[0]})
    return trainers


def read_trainer_class_audio_arguments(entries: list[bytes | None]) -> list[int | None]:
    arguments = []
    for class_id, entry in enumerate(entries):
        if entry is None:
            arguments.append(None)
            continue
        if len(entry) != TRAINER_CLASS_SIZE:
            raise ValueError(f"trclass[{class_id}] tem {len(entry)} bytes; esperado {TRAINER_CLASS_SIZE}")
        arguments.append(struct.unpack_from("<I", entry, TRAINER_CLASS_BGM_OFFSET)[0])
    return arguments

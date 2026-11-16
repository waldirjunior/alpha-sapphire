#!/usr/bin/env python3
"""Desempacota arquivos GARC (CRAG v4) com suporte a descompressão LZ11 opcional.

Uso típico:
  python3 scripts/unpack_garc.py --garc .../RomFS/a/0/4/0 --out .../rom/extracted/garc/a_0_4_0 --decompress
"""

from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path


def decompress_lz11(data: bytes) -> bytes:
    """Descomprime buffer Nintendo LZ11 (magic byte 0x11)."""
    if len(data) < 4 or data[0] != 0x11:
        return data

    out_len = data[1] | (data[2] << 8) | (data[3] << 16)
    pos = 4
    if out_len == 0 and len(data) >= 8:
        out_len = struct.unpack_from("<I", data, 4)[0]
        pos = 8

    out = bytearray()
    while len(out) < out_len and pos < len(data):
        flags = data[pos]
        pos += 1
        for bit in range(7, -1, -1):
            if len(out) >= out_len or pos >= len(data):
                break
            if (flags >> bit) & 1:
                b1 = data[pos]
                pos += 1
                indicator = b1 >> 4
                if indicator == 0:
                    if pos + 1 >= len(data):
                        break
                    b2 = data[pos]
                    b3 = data[pos + 1]
                    pos += 2
                    length = (((b1 & 0x0F) << 4) | (b2 >> 4)) + 0x11
                    disp = (((b2 & 0x0F) << 8) | b3) + 1
                elif indicator == 1:
                    if pos + 2 >= len(data):
                        break
                    b2 = data[pos]
                    b3 = data[pos + 1]
                    b4 = data[pos + 2]
                    pos += 3
                    length = (((b1 & 0x0F) << 12) | (b2 << 4) | (b3 >> 4)) + 0x111
                    disp = (((b3 & 0x0F) << 8) | b4) + 1
                else:
                    if pos >= len(data):
                        break
                    b2 = data[pos]
                    pos += 1
                    length = indicator + 1
                    disp = (((b1 & 0x0F) << 8) | b2) + 1

                for _ in range(length):
                    if len(out) >= out_len:
                        break
                    out.append(out[-disp])
            else:
                out.append(data[pos])
                pos += 1

    return bytes(out)


def unpack_garc(garc_path: Path, out_dir: Path, decompress: bool = False, limit: int | None = None) -> int:
    if not garc_path.is_file():
        raise FileNotFoundError(f"GARC não encontrado: {garc_path}")

    out_dir.mkdir(parents=True, exist_ok=True)
    with garc_path.open("rb") as f:
        hdr = f.read(28)
        if len(hdr) < 28 or hdr[:4] != b"CRAG":
            raise ValueError(f"Arquivo não é GARC (CRAG): {garc_path}")

        _magic, hdr_len, _endian, _version, _chunks, data_offset, _file_size, _max_pad = struct.unpack(
            "<4sIHHIIII", hdr
        )
        f.seek(hdr_len)
        fato_hdr = f.read(12)
        fato_size, _fato_count, _pad = struct.unpack("<IHH", fato_hdr[4:])
        f.seek(hdr_len + fato_size)
        fatb_hdr = f.read(12)
        _fatb_size, fatb_count = struct.unpack("<II", fatb_hdr[4:])

        count = min(fatb_count, limit) if limit is not None else fatb_count
        extracted = 0
        for idx in range(count):
            bitmask_raw = f.read(4)
            if len(bitmask_raw) < 4:
                break
            bitmask = struct.unpack("<I", bitmask_raw)[0]
            bits = bin(bitmask).count("1")
            entries_raw = f.read(12 * bits)
            if bits == 0 or len(entries_raw) < 12:
                continue

            for sub_idx in range(bits):
                start, _end, length = struct.unpack_from("<III", entries_raw, sub_idx * 12)
                if length == 0:
                    continue
                cur = f.tell()
                f.seek(data_offset + start)
                blob = f.read(length)
                f.seek(cur)

                if decompress and blob and blob[0] == 0x11:
                    try:
                        blob = decompress_lz11(blob)
                    except IndexError:
                        pass

                suffix = f"_{sub_idx}" if bits > 1 else ""
                (out_dir / f"{idx:04d}{suffix}.bin").write_bytes(blob)
                extracted += 1

        return extracted


def main() -> int:
    parser = argparse.ArgumentParser(description="Desempacota arquivo GARC (CRAG v4).")
    parser.add_argument("--garc", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--decompress", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    n = unpack_garc(args.garc, args.out, decompress=args.decompress, limit=args.limit)
    print(f"Extraídos {n} subarquivos para {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Extrai textos decodificados (Gen 6 XOR 0x7C89) da RomFS para JSON em src/data/texts/."""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path


def decode_gen6_text(blob: bytes) -> list[str]:
    if len(blob) < 16:
        return []
    _sections, line_count, _total_len, _init_key, _sec_len = struct.unpack_from("<HHIII", blob, 0)
    base = 16
    lines: list[str] = []
    key = 0x7C89
    for i in range(line_count):
        if base + 4 + (i + 1) * 8 > len(blob):
            break
        off, length, _unk = struct.unpack_from("<IHH", blob, base + 4 + i * 8)
        k = key
        raw_codes: list[int] = []
        for j in range(length):
            if base + off + (j + 1) * 2 > len(blob):
                break
            c = struct.unpack_from("<H", blob, base + off + j * 2)[0] ^ k
            k = ((k << 3) | (k >> 13)) & 0xFFFF
            if c == 0:
                break
            raw_codes.append(c)

        chars: list[str] = []
        idx = 0
        while idx < len(raw_codes):
            c = raw_codes[idx]
            if c == 0x0010 and idx + 2 < len(raw_codes):
                # Tag de controle Gen 6: [0x0010, arg_count, tag_id, ...args]
                arg_count = raw_codes[idx + 1]
                idx += 2 + arg_count
                continue
            if c in (0xBE00, 0xBE01, 0xBE02):
                chars.append("\n")
            elif c == 0x000A:
                chars.append("\n")
            elif 32 <= c < 0xE000 and c != 0xBDFF:
                chars.append(chr(c))
            idx += 1

        text = "\n".join(part.strip() for part in "".join(chars).splitlines() if part.strip())
        lines.append(text)
        key = (key + 0x2983) & 0xFFFF
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai textos selecionados de a/0/8/1 e a/0/7/3 para JSON.")
    parser.add_argument("--garc-root", required=True, type=Path, help="Diretório rom/extracted/garc")
    parser.add_argument("--out-dir", required=True, type=Path, help="Diretório src/data/texts")
    args = parser.parse_args()

    targets = {
        "littleroot_town": args.garc_root / "a_0_8_1" / "0066.bin",
        "oldale_town": args.garc_root / "a_0_8_1" / "0060.bin",
        "birch_lab": args.garc_root / "a_0_8_1" / "0061.bin",
        "location_names": args.garc_root / "a_0_7_3" / "0090.bin",
    }

    args.out_dir.mkdir(parents=True, exist_ok=True)
    for name, src in targets.items():
        if not src.is_file():
            raise FileNotFoundError(f"Arquivo de texto não encontrado: {src}")
        lines = [l for l in decode_gen6_text(src.read_bytes()) if l]
        out_file = args.out_dir / f"{name}.json"
        out_file.write_text(json.dumps({"id": name, "lines": lines}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Extraído {out_file} ({len(lines)} linhas)")

    return 0


if __name__ == "__main__":
    sys.exit(main())

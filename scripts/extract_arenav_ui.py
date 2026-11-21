#!/usr/bin/env python3
"""Extract AreaNav textures and CLYT pane bounds from a local RomFS."""

from __future__ import annotations

import argparse
import io
import json
import struct
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

try:
    from .inspect_arenav_assets import decode_entry, read_garc_index
    from .townmap_probe_formats import DarcEntry, parse_darc, write_png
except ImportError:
    from inspect_arenav_assets import decode_entry, read_garc_index
    from townmap_probe_formats import DarcEntry, parse_darc, write_png


AREA_NAV_ARCHIVE = "a/0/6/7"
TEXTURE_OUTPUTS = {
    "poke_navi_map.bclim": "poke_navi_map.png",
    "map_city_icon01.bclim": "map_city_icon01.png",
    "map_city_icon02.bclim": "map_city_icon02.png",
    "map_city_icon03.bclim": "map_city_icon03.png",
    "hero_obj.bclim": "hero_obj.png",
    "heroine_obj.bclim": "heroine_obj.png",
    "cursol.bclim": "cursol.png",
    "poke_point.bclim": "poke_point.png",
}
ENGLISH_MAP_NAV_ARCHIVE = "a/2/7/6"
ENGLISH_MAP_NAV_SUBFILE = 1
MAP_NAV_TEXTURES = tuple(f"map_navi{index:02}.bclim" for index in range(1, 6))
CHROMA_KEY_TEXTURES = frozenset({
    "map_city_icon01.bclim",
    "map_city_icon02.bclim",
    "map_city_icon03.bclim",
    "cursol.bclim",
})
CYAN_COLOR_KEYS = {(0, 255, 255), (0, 255, 221)}


@dataclass(frozen=True)
class ClytPane:
    kind: str
    name: str
    x: float
    y: float
    width: float
    height: float
    material_index: int | None = None
    vertex_colors: tuple[tuple[int, int, int, int], ...] | None = None


def parse_clyt(blob: bytes) -> list[ClytPane]:
    file_size, section_count = _clyt_header(blob)
    panes: list[ClytPane] = []
    cursor = 20
    for _ in range(section_count):
        kind, section_size = _read_section_header(blob, cursor, file_size)
        if kind in ("pan1", "pic1", "txt1"):
            panes.append(_parse_clyt_pane(blob, cursor, kind, section_size))
        cursor += section_size
    return panes


def _clyt_header(blob: bytes) -> tuple[int, int]:
    if len(blob) < 20 or blob[:4] != b"CLYT":
        raise ValueError("Esperado CLYT com cabeçalho de 20 bytes")
    bom, header_size = struct.unpack_from("<HH", blob, 4)
    file_size, section_count = struct.unpack_from("<II", blob, 12)
    if bom != 0xFEFF or header_size != 20 or not 20 <= file_size <= len(blob):
        raise ValueError(f"Cabeçalho CLYT inválido: bom={bom:#x}, header={header_size}, size={file_size}")
    return file_size, section_count


def _read_section_header(blob: bytes, cursor: int, file_size: int) -> tuple[str, int]:
    if cursor + 8 > file_size:
        raise ValueError(f"CLYT chunk truncado no offset {cursor:#x}")
    kind = blob[cursor:cursor + 4].decode("ascii", errors="replace")
    section_size = struct.unpack_from("<I", blob, cursor + 4)[0]
    if section_size < 8 or cursor + section_size > file_size:
        raise ValueError(f"CLYT chunk {kind!r} tem tamanho fora do arquivo no offset {cursor:#x}")
    return kind, section_size


def _parse_clyt_pane(blob: bytes, cursor: int, kind: str, section_size: int) -> ClytPane:
    minimum_size = {"pan1": 76, "pic1": 128, "txt1": 140}[kind]
    if section_size < minimum_size:
        raise ValueError(f"CLYT chunk {kind!r} curto: {section_size} bytes, esperado ao menos {minimum_size}")
    name = blob[cursor + 12:cursor + 36].split(b"\0", 1)[0].decode("ascii", errors="replace")
    x, y, _, _, _, _, _, _, width, height = struct.unpack_from("<10f", blob, cursor + 36)
    material_index, vertex_colors = _pic1_metadata(blob, cursor, kind)
    return ClytPane(kind, name, x, y, width, height, material_index, vertex_colors)


def _pic1_metadata(
    blob: bytes,
    cursor: int,
    kind: str,
) -> tuple[int | None, tuple[tuple[int, int, int, int], ...] | None]:
    if kind != "pic1":
        return None, None
    vertex_colors = tuple(
        tuple(blob[cursor + 76 + offset:cursor + 80 + offset])
        for offset in (0, 4, 8, 12)
    )
    material_index = struct.unpack_from("<H", blob, cursor + 92)[0]
    return material_index, vertex_colors


def _darc_members(romfs: Path, archive_name: str, subfiles: set[int] | None = None) -> list[DarcEntry]:
    archive_path = romfs / archive_name
    if not archive_path.is_file():
        return []
    blob = archive_path.read_bytes()
    _, entries = read_garc_index(io.BytesIO(blob), len(blob))
    members: list[DarcEntry] = []
    for entry in entries:
        if subfiles is not None and entry.subfile not in subfiles:
            continue
        payload = decode_entry(blob[entry.offset:entry.offset + entry.length])
        members.extend(_nested_darc_members(payload))
    return members


def _nested_darc_members(payload: bytes) -> list[DarcEntry]:
    members: list[DarcEntry] = []
    offset = 0
    while (offset := payload.find(b"darc", offset)) >= 0:
        try:
            members.extend(parse_darc(payload, offset))
        except ValueError:
            offset += 1
            continue
        offset += 4
    return members


def _named_members(members: list[DarcEntry]) -> dict[str, DarcEntry]:
    return {Path(member.name).name: member for member in members}


def _export_texture(members: dict[str, DarcEntry], source_name: str, output_name: str, output_dir: Path) -> bool:
    member = members.get(source_name)
    color_key = CYAN_COLOR_KEYS if source_name in CHROMA_KEY_TEXTURES else None
    if member is None or not write_png(member.data, output_dir / output_name, color_key):
        return False
    return True


def extract_arenav_ui(romfs: Path, output_dir: Path) -> list[str]:
    area_members = _named_members(_darc_members(romfs, AREA_NAV_ARCHIVE))
    required = ("poke_navi_map.bclim", "map_lower.bclyt")
    missing = [name for name in required if name not in area_members]
    if missing:
        raise ValueError(f"{AREA_NAV_ARCHIVE} sem recursos AreaNav obrigatórios: {', '.join(missing)}")

    output_dir.mkdir(parents=True, exist_ok=True)
    extracted = [
        output_name
        for source_name, output_name in TEXTURE_OUTPUTS.items()
        if _export_texture(area_members, source_name, output_name, output_dir)
    ]
    _write_layout(area_members["map_lower.bclyt"].data, output_dir)
    extracted.append("map_lower.layout.json")
    _extract_english_map_nav(romfs, output_dir, extracted)
    _extract_secondary_map(romfs, output_dir, extracted)
    _extract_finger_icon(romfs, output_dir, extracted)
    return extracted


def _write_layout(layout_blob: bytes, output_dir: Path) -> None:
    panes = [asdict(pane) for pane in parse_clyt(layout_blob)]
    (output_dir / "map_lower.layout.json").write_text(
        json.dumps(panes, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def _extract_english_map_nav(romfs: Path, output_dir: Path, extracted: list[str]) -> None:
    members = _named_members(_darc_members(romfs, ENGLISH_MAP_NAV_ARCHIVE, {ENGLISH_MAP_NAV_SUBFILE}))
    for source_name in MAP_NAV_TEXTURES:
        output_name = source_name.removesuffix(".bclim") + ".png"
        if _export_texture(members, source_name, output_name, output_dir):
            extracted.append(output_name)


def _extract_secondary_map(romfs: Path, output_dir: Path, extracted: list[str]) -> None:
    members = _named_members(_darc_members(romfs, "a/2/5/5", {0}))
    if _export_texture(members, "map.bclim", "map.png", output_dir):
        extracted.append("map.png")


def _extract_finger_icon(romfs: Path, output_dir: Path, extracted: list[str]) -> None:
    members = _named_members(_darc_members(romfs, "a/1/5/0", {0}))
    if _export_texture(members, "finger_icon.bclim", "finger_icon.png", output_dir):
        extracted.append("finger_icon.png")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--romfs", required=True, type=Path, help="Diretório RomFS extraído")
    parser.add_argument("--output", type=Path, required=True, help="Saída local, normalmente public/assets/ui/arenav")
    args = parser.parse_args()
    extracted = extract_arenav_ui(args.romfs, args.output)
    print(f"Recursos AreaNav extraídos ({len(extracted)}): {args.output}")
    for name in extracted:
        print(f"  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

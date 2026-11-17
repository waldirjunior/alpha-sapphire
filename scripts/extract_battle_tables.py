#!/usr/bin/env python3
"""Extrai tabelas de batalha Gen 6 (ORAS) da ROM para JSON em src/data/battle/ (só números e nomes curtos).

Fontes (layout validado contra pk3DS; ver docs/features/pipeline-rom/battle-tables.md):
  personal  a/1/9/5 (último arquivo = tabela completa, 0x50 bytes por entrada)
  moves     a/1/8/9 (arquivo único, mini-pack "WD" de entradas de 0x22 bytes)
  levelup   a/1/9/1 (um arquivo por entrada de personal, pares <hh> terminados em -1)
  types     DllBattle.cro @0xDB428 (18x18 bytes, multiplicador x4)
  TM/HM     code.bin, logo após a assinatura D4 00 AE 02 AF 02 B0 02
  nomes     a/0/7/3 (gametext EN): 0014 golpes, 0018 tipos, 0037 habilidades, 0098 espécies

Uso:
  python3 scripts/extract_battle_tables.py --garc-root rom/extracted/garc \\
      --romfs rom/extracted/RomFS --exefs rom/extracted/ExeFS --out-dir src/data/battle
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

from extract_texts import decode_gen6_text

PERSONAL_SIZE = 0x50
MOVE_SIZE = 0x22
TYPE_COUNT = 18
TYPE_CHART_OFFSET_ORAS = 0xDB428
TM_SIGNATURE = bytes([0xD4, 0x00, 0xAE, 0x02, 0xAF, 0x02, 0xB0, 0x02])
TM_SEARCH_START = 0x400000
TM_COUNT = 100
HM_COUNT = 7
NATIONAL_DEX_MAX = 721

GROWTH_RATES = ("medium_fast", "erratic", "fluctuating", "medium_slow", "fast", "slow")
EGG_GROUPS = (
    "none", "monster", "water1", "bug", "flying", "field", "fairy", "grass", "human_like",
    "water3", "mineral", "amorphous", "water2", "ditto", "dragon", "undiscovered",
)
MOVE_CATEGORIES = ("status", "physical", "special")
STAT_KEYS = ("hp", "atk", "def", "spe", "spa", "spd")


def read_bits(blob: bytes) -> list[bool]:
    return [bool(blob[i // 8] >> (i % 8) & 1) for i in range(len(blob) * 8)]


def parse_personal(entry: bytes) -> dict[str, object]:
    if len(entry) != PERSONAL_SIZE:
        raise ValueError(f"Entrada personal com {len(entry)} bytes; esperado {PERSONAL_SIZE}")
    ev_yield = struct.unpack_from("<H", entry, 0x0A)[0]
    tmhm = read_bits(entry[0x28:0x38])
    return {
        "baseStats": {key: entry[i] for i, key in enumerate(STAT_KEYS)},
        "types": [entry[0x06], entry[0x07]],
        "catchRate": entry[0x08],
        "evolutionStage": entry[0x09],
        "evYield": {key: ev_yield >> (2 * i) & 0x3 for i, key in enumerate(STAT_KEYS)},
        "heldItems": list(struct.unpack_from("<3H", entry, 0x0C)),
        "genderRatio": entry[0x12],
        "hatchCycles": entry[0x13],
        "baseFriendship": entry[0x14],
        "growthRate": GROWTH_RATES[entry[0x15]],
        "eggGroups": [EGG_GROUPS[entry[0x16]], EGG_GROUPS[entry[0x17]]],
        "abilities": [entry[0x18], entry[0x19], entry[0x1A]],
        "formStatsIndex": struct.unpack_from("<H", entry, 0x1C)[0],
        "formCount": entry[0x20],
        "baseExp": struct.unpack_from("<H", entry, 0x22)[0],
        "heightDm": struct.unpack_from("<H", entry, 0x24)[0],
        "weightHg": struct.unpack_from("<H", entry, 0x26)[0],
        "tms": [i + 1 for i in range(TM_COUNT) if tmhm[i]],
        "hms": [i + 1 for i in range(HM_COUNT) if tmhm[TM_COUNT + i]],
    }


def parse_personal_table(table: bytes) -> list[dict[str, object]]:
    if len(table) % PERSONAL_SIZE:
        raise ValueError(f"Tabela personal com {len(table)} bytes não é múltipla de {PERSONAL_SIZE}")
    return [parse_personal(table[i:i + PERSONAL_SIZE]) for i in range(0, len(table), PERSONAL_SIZE)]


def resolve_form_owners(entries: list[dict[str, object]]) -> dict[int, tuple[int, int]]:
    """Mapeia índice personal de forma alternativa (>721) para (espécie, forma)."""
    owners: dict[int, tuple[int, int]] = {}
    for species, entry in enumerate(entries[:NATIONAL_DEX_MAX + 1]):
        first, count = int(entry["formStatsIndex"]), int(entry["formCount"])
        if first == 0:
            continue
        for form in range(1, count):
            owners[first + form - 1] = (species, form)
    return owners


def unpack_mini(blob: bytes, ident: bytes) -> list[bytes]:
    if blob[:2] != ident:
        raise ValueError(f"Mini-pack com magic {blob[:2]!r}; esperado {ident!r}")
    count = struct.unpack_from("<H", blob, 2)[0]
    offsets = struct.unpack_from(f"<{count + 1}I", blob, 4)
    return [blob[offsets[i]:offsets[i + 1]] for i in range(count)]


def parse_move(entry: bytes) -> dict[str, object]:
    if len(entry) < MOVE_SIZE:
        raise ValueError(f"Entrada de golpe com {len(entry)} bytes; esperado {MOVE_SIZE}")
    return {
        "type": entry[0x00],
        "quality": entry[0x01],
        "category": MOVE_CATEGORIES[entry[0x02]],
        "power": entry[0x03],
        "accuracy": entry[0x04],
        "pp": entry[0x05],
        "priority": struct.unpack_from("<b", entry, 0x06)[0],
        "hitMin": entry[0x07] & 0xF,
        "hitMax": entry[0x07] >> 4,
        "inflict": struct.unpack_from("<H", entry, 0x08)[0],
        "inflictPercent": entry[0x0A],
        "inflictDuration": entry[0x0B],
        "turnMin": entry[0x0C],
        "turnMax": entry[0x0D],
        "critStage": entry[0x0E],
        "flinchPercent": entry[0x0F],
        "effectSequence": struct.unpack_from("<H", entry, 0x10)[0],
        "recoilPercent": struct.unpack_from("<b", entry, 0x12)[0],
        "healing": entry[0x13],
        "target": entry[0x14],
        "statChanges": parse_stat_changes(entry),
        "flags": struct.unpack_from("<I", entry, 0x1E)[0],
    }


def parse_stat_changes(entry: bytes) -> list[dict[str, int]]:
    changes = []
    for i in range(3):
        stat = entry[0x15 + i]
        if stat == 0:
            continue
        stage = struct.unpack_from("<b", entry, 0x18 + i)[0]
        changes.append({"stat": stat, "stages": stage, "percent": entry[0x1B + i]})
    return changes


def parse_learnset(blob: bytes) -> list[dict[str, int]]:
    if len(blob) % 4:
        raise ValueError(f"Learnset com {len(blob)} bytes não é múltiplo de 4")
    learnset = []
    for move, level in struct.iter_unpack("<hh", blob):
        if move == -1:
            break
        learnset.append({"level": level, "move": move})
    return learnset


def parse_type_chart(cro: bytes, offset: int = TYPE_CHART_OFFSET_ORAS) -> list[list[float]]:
    """Linhas = tipo atacante, colunas = tipo defensor; valor bruto 0/2/4/8 = x0/x0.5/x1/x2."""
    raw = cro[offset:offset + TYPE_COUNT * TYPE_COUNT]
    if len(raw) != TYPE_COUNT * TYPE_COUNT or set(raw) - {0, 2, 4, 8}:
        raise ValueError(f"Tabela de tipos inválida em 0x{offset:X}: esperado {TYPE_COUNT}² bytes em {{0,2,4,8}}")
    return [[raw[a * TYPE_COUNT + d] / 4 for d in range(TYPE_COUNT)] for a in range(TYPE_COUNT)]


def parse_tm_moves(code: bytes) -> dict[str, list[int]]:
    """Ordem ORAS no code.bin: TM01-92, HM01-05, HM06, TM93-100, HM07 (pk3DS TMHMEditor6)."""
    sig = code.find(TM_SIGNATURE, TM_SEARCH_START)
    if sig < 0:
        raise ValueError("Assinatura da lista de TMs não encontrada no code.bin (está descomprimido?)")
    raw = struct.unpack_from("<107H", code, sig + len(TM_SIGNATURE))
    return {
        "tms": list(raw[0:92]) + list(raw[98:106]),
        "hms": list(raw[92:97]) + [raw[97], raw[106]],
    }


def read_names(text_dir: Path, file_index: int) -> list[str]:
    return decode_gen6_text((text_dir / f"{file_index:04d}.bin").read_bytes())


def build_species(personal: list[dict[str, object]], names: dict[str, list[str]]) -> list[dict[str, object]]:
    owners = resolve_form_owners(personal)
    entries = []
    for index, entry in enumerate(personal):
        species, form = owners.get(index, (index, 0))
        if index > NATIONAL_DEX_MAX and index not in owners:
            continue
        entries.append({
            "personalIndex": index,
            "species": species,
            "form": form,
            "name": names["species"][species],
            **entry,
            "types": [names["types"][t] for t in entry["types"]],
            "abilities": [names["abilities"][a] for a in entry["abilities"]],
        })
    return entries


def build_moves(move_blobs: list[bytes], names: dict[str, list[str]]) -> list[dict[str, object]]:
    moves = []
    for move_id, blob in enumerate(move_blobs):
        move = parse_move(blob)
        moves.append({"id": move_id, "name": names["moves"][move_id], **move, "type": names["types"][int(move["type"])]})
    return moves


def compact(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def write_json(path: Path, payload: list[object] | dict[str, object]) -> None:
    """Um registro por linha: arquivo pequeno e diffs legíveis por espécie/golpe."""
    if isinstance(payload, list):
        body = "[\n" + ",\n".join(compact(item) for item in payload) + "\n]"
    else:
        body = "{\n" + ",\n".join(f"{compact(k)}:{compact(v)}" for k, v in payload.items()) + "\n}"
    path.write_text(body + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrai personal, golpes, tipos e learnsets ORAS para JSON.")
    parser.add_argument("--garc-root", required=True, type=Path, help="rom/extracted/garc (a_1_8_9, a_1_9_1, a_1_9_5, a_0_7_3)")
    parser.add_argument("--romfs", required=True, type=Path)
    parser.add_argument("--exefs", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()

    text_dir = args.garc_root / "a_0_7_3"
    names = {
        "moves": read_names(text_dir, 14),
        "types": read_names(text_dir, 18),
        "abilities": read_names(text_dir, 37),
        "species": read_names(text_dir, 98),
    }
    personal_files = sorted((args.garc_root / "a_1_9_5").glob("*.bin"))
    personal = parse_personal_table(personal_files[-1].read_bytes())
    move_blobs = unpack_mini((args.garc_root / "a_1_8_9" / "0000.bin").read_bytes(), b"WD")
    learnset_files = sorted((args.garc_root / "a_1_9_1").glob("*.bin"))
    chart = parse_type_chart((args.romfs / "DllBattle.cro").read_bytes())
    tm_moves = parse_tm_moves((args.exefs / "code.bin").read_bytes())

    args.out_dir.mkdir(parents=True, exist_ok=True)
    write_json(args.out_dir / "species.json", build_species(personal, names))
    write_json(args.out_dir / "moves.json", build_moves(move_blobs, names))
    write_json(args.out_dir / "types.json", {"types": names["types"][:TYPE_COUNT], "effectiveness": chart})
    write_json(args.out_dir / "learnsets.json", [
        {"personalIndex": i, "levelUp": parse_learnset(f.read_bytes())} for i, f in enumerate(learnset_files)
    ])
    write_json(args.out_dir / "machines.json", {"tmMoves": tm_moves["tms"], "hmMoves": tm_moves["hms"]})
    print(f"species={len(personal)} moves={len(move_blobs)} learnsets={len(learnset_files)} -> {args.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

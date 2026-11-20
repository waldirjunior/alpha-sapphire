#!/usr/bin/env python3
"""Testes unitários determinísticos para os parsers do pipeline da ROM (fixtures sintéticas)."""

from __future__ import annotations

import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from battle_progression_parsers import annotate_evolution, build_natures, parse_evolution_set
from extract_battle_tables import (
    PERSONAL_SIZE,
    TM_SIGNATURE,
    parse_trainer_record,
    parse_trainer_tables,
    parse_learnset,
    parse_move,
    parse_personal,
    parse_personal_table,
    parse_tm_moves,
    parse_type_chart,
    resolve_form_owners,
    unpack_mini,
)
from extract_gr_maps import parse_gr_grid
from extract_zone_audio import build_zone_audio, parse_bcsar_sounds, read_zone_bgm_indexes, read_zone_bgm_table
from convert_gr_to_glb import (
    parse_missing_textures,
    patch_glb_materials,
    pica_alpha_state,
    select_texture_archive,
)
from extract_texts import decode_gen6_text
from unpack_garc import decompress_lz11


def encode_single_line(codes: list[int]) -> bytes:
    key = 0x7C89
    encoded: list[int] = []
    for code in [*codes, 0]:
        encoded.append(code ^ key)
        key = ((key << 3) | (key >> 13)) & 0xFFFF
    char_bytes = struct.pack(f"<{len(encoded)}H", *encoded)
    sec_header = struct.pack("<I", len(char_bytes)) + struct.pack("<IHH", 12, len(encoded), 0)
    header = struct.pack("<HHIII", 1, 1, 16 + len(sec_header) + len(char_bytes), 0, len(sec_header) + len(char_bytes))
    return header + sec_header + char_bytes


class PipelineParsersTest(unittest.TestCase):
    def test_decompress_lz11_literal_only(self) -> None:
        # 4 bytes descomprimidos: b"ABCD", flag byte 0x00 = 8 literais
        payload = bytes([0x11, 0x04, 0x00, 0x00, 0x00]) + b"ABCD"
        self.assertEqual(decompress_lz11(payload), b"ABCD")

    def test_parse_gr_grid_synthetic(self) -> None:
        # Mini-container GR com 1 seção (2x2 tiles)
        sec0 = struct.pack("<HH", 2, 2) + struct.pack("<4I", 0x00000020, 0x01000021, 0x20004004, 0x00000020)
        sec0_off = 16
        sec1_off = sec0_off + len(sec0)
        gr_blob = struct.pack("<2sHII4s", b"GR", 1, sec0_off, sec1_off, b"\x00" * 4) + sec0

        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "test.gr"
            p.write_bytes(gr_blob)
            w, h, collisions, terrain = parse_gr_grid(p)

        self.assertEqual((w, h), (2, 2))
        self.assertEqual(collisions, [[0, 1], [0, 0]])
        self.assertEqual(terrain, [[0, 1], [2, 0]])

    def test_decode_gen6_text_synthetic(self) -> None:
        text = "Hi"
        key = 0x7C89
        encoded_chars: list[int] = []
        for ch in text:
            encoded_chars.append(ord(ch) ^ key)
            key = ((key << 3) | (key >> 13)) & 0xFFFF
        encoded_chars.append(0 ^ key)

        char_bytes = struct.pack(f"<{len(encoded_chars)}H", *encoded_chars)
        line_table_off = 4 + 8  # dentro da seção (base = 16)
        sec_header = struct.pack("<I", len(char_bytes)) + struct.pack("<IHH", line_table_off, len(encoded_chars), 0)
        header = struct.pack("<HHIII", 1, 1, 16 + len(sec_header) + len(char_bytes), 0, len(sec_header) + len(char_bytes))
        blob = header + sec_header + char_bytes

        self.assertEqual(decode_gen6_text(blob), ["Hi"])

    def test_decode_gen6_text_maps_gender_glyphs(self) -> None:
        self.assertEqual(decode_gen6_text(encode_single_line([0x4E, 0xE08F])), ["N♀"])
        self.assertEqual(decode_gen6_text(encode_single_line([0x4E, 0xE08E])), ["N♂"])


def build_personal(stats: tuple[int, ...], form_index: int = 0, form_count: int = 1, tm_bits: tuple[int, ...] = ()) -> bytes:
    entry = bytearray(PERSONAL_SIZE)
    entry[0:6] = bytes(stats)
    entry[0x06:0x08] = bytes([12, 12])
    entry[0x0A:0x0C] = struct.pack("<H", 1 << 6)
    entry[0x15] = 3
    entry[0x16:0x18] = bytes([1, 14])
    entry[0x18:0x1B] = bytes([65, 65, 84])
    entry[0x1C:0x1E] = struct.pack("<H", form_index)
    entry[0x20] = form_count
    for bit in tm_bits:
        entry[0x28 + bit // 8] |= 1 << (bit % 8)
    return bytes(entry)


class BattleTablesTest(unittest.TestCase):
    def test_parse_trainer_record_preserves_class_and_rom_iv_byte(self) -> None:
        metadata = bytearray(24)
        struct.pack_into("<HH", metadata, 0, 0, 129)
        metadata[6:8] = bytes([2, 2])
        team = struct.pack("<BBHHH", 40, 1, 5, 261, 0) + struct.pack("<BBHHH", 120, 2, 7, 263, 1)

        trainer = parse_trainer_record(17, bytes(metadata), team, ["None"] * 129 + ["Youngster"])

        self.assertEqual(trainer, {
            "id": 17,
            "classId": 129,
            "className": "Youngster",
            "party": [
                {"speciesId": 261, "form": 0, "level": 5, "ivByte": 40},
                {"speciesId": 263, "form": 1, "level": 7, "ivByte": 120},
            ],
        })

    def test_parse_trainer_record_reads_explicit_moves_and_held_item(self) -> None:
        metadata = bytearray(24)
        struct.pack_into("<HH", metadata, 0, 3, 129)
        metadata[7] = 1
        member = struct.pack("<BBHHH", 40, 1, 5, 261, 0)
        member += struct.pack("<H4H", 210, 33, 81, 0, 0)

        trainer = parse_trainer_record(17, bytes(metadata), member, ["None"] * 129 + ["Youngster"])

        self.assertEqual(trainer["party"][0], {
            "speciesId": 261,
            "form": 0,
            "level": 5,
            "ivByte": 40,
            "heldItemId": 210,
            "moveIds": [33, 81],
        })

    def test_parse_trainer_record_reads_held_item_without_custom_moves(self) -> None:
        metadata = bytearray(24)
        struct.pack_into("<HH", metadata, 0, 2, 129)
        metadata[7] = 1
        member = struct.pack("<BBHHHH", 40, 1, 5, 261, 0, 210)

        trainer = parse_trainer_record(17, bytes(metadata), member, ["None"] * 129 + ["Youngster"])

        self.assertEqual(trainer["party"][0]["heldItemId"], 210)
        self.assertNotIn("moveIds", trainer["party"][0])

    def test_parse_trainer_tables_rejects_party_count_mismatch(self) -> None:
        metadata = bytearray(24)
        metadata[7] = 2
        with self.assertRaisesRegex(ValueError, "contagem da equipe"):
            parse_trainer_tables([bytes(metadata)], [bytes(8)], ["None"])

    def test_parse_personal_reads_treecko_layout(self) -> None:
        # Ordem do arquivo: HP, ATK, DEF, SPE, SPA, SPD (Treecko 40/45/35/70/65/55)
        entry = parse_personal(build_personal((40, 45, 35, 70, 65, 55), tm_bits=(0, 99, 100, 106)))
        self.assertEqual(entry["baseStats"], {"hp": 40, "atk": 45, "def": 35, "spe": 70, "spa": 65, "spd": 55})
        self.assertEqual(entry["types"], [12, 12])
        self.assertEqual(entry["evYield"]["spe"], 1)
        self.assertEqual(entry["growthRate"], "medium_slow")
        self.assertEqual(entry["eggGroups"], ["monster", "dragon"])
        self.assertEqual(entry["abilities"], [65, 65, 84])
        self.assertEqual((entry["tms"], entry["hms"]), ([1, 100], [1, 7]))

    def test_parse_personal_rejects_wrong_size(self) -> None:
        with self.assertRaisesRegex(ValueError, "esperado 80"):
            parse_personal(bytes(0x40))

    def test_resolve_form_owners_maps_alt_forms_past_national_dex(self) -> None:
        table = [build_personal((1,) * 6) for _ in range(722)]
        table[386] = build_personal((50,) * 6, form_index=722, form_count=3)
        table += [build_personal((2,) * 6), build_personal((3,) * 6)]
        entries = parse_personal_table(b"".join(table))
        self.assertEqual(resolve_form_owners(entries), {722: (386, 1), 723: (386, 2)})

    def test_unpack_mini_splits_by_offsets(self) -> None:
        blob = b"WD" + struct.pack("<H3I", 2, 16, 18, 21) + b"ab" + b"cde"
        self.assertEqual(unpack_mini(blob, b"WD"), [b"ab", b"cde"])
        with self.assertRaisesRegex(ValueError, "magic"):
            unpack_mini(b"XX" + blob[2:], b"WD")

    def test_parse_move_reads_tackle_and_signed_fields(self) -> None:
        raw = bytearray(0x22)
        raw[0:7] = bytes([0, 0, 1, 50, 100, 35, 0xFF])
        raw[0x15], raw[0x18], raw[0x1B] = 2, 0xFF, 100
        move = parse_move(bytes(raw))
        self.assertEqual((move["category"], move["power"], move["accuracy"], move["pp"]), ("physical", 50, 100, 35))
        self.assertEqual(move["priority"], -1)
        self.assertEqual(move["statChanges"], [{"stat": 2, "stages": -1, "percent": 100}])

    def test_parse_learnset_stops_at_terminator(self) -> None:
        blob = struct.pack("<4h", 1, 1, 71, 5) + struct.pack("<i", -1)
        self.assertEqual(parse_learnset(blob), [{"level": 1, "move": 1}, {"level": 5, "move": 71}])

    def test_parse_type_chart_scales_and_validates(self) -> None:
        raw = bytearray([4] * 18 * 18)
        raw[9 * 18 + 11] = 8
        raw[0 * 18 + 7] = 0
        chart = parse_type_chart(b"\xAA" * 3 + bytes(raw), offset=3)
        self.assertEqual((chart[9][11], chart[0][7], chart[0][0]), (2.0, 0.0, 1.0))
        with self.assertRaisesRegex(ValueError, "inválida"):
            parse_type_chart(b"\x03" * 400, offset=0)

    def test_parse_tm_moves_follows_oras_interleaving(self) -> None:
        values = list(range(1000, 1107))
        code = bytes(0x400000) + TM_SIGNATURE + struct.pack("<107H", *values)
        machines = parse_tm_moves(code)
        self.assertEqual(len(machines["tms"]), 100)
        self.assertEqual(machines["tms"][91:93], [1091, 1098])
        self.assertEqual(machines["hms"], [1092, 1093, 1094, 1095, 1096, 1097, 1106])


class ProgressionParsersTest(unittest.TestCase):
    def test_parse_evolution_set_skips_empty_slots(self) -> None:
        blob = struct.pack("<3H", 4, 16, 253) + struct.pack("<3H", 8, 83, 135) + bytes(36)
        self.assertEqual(parse_evolution_set(blob), [
            {"method": "level", "argument": 16, "species": 253},
            {"method": "use_item", "argument": 83, "species": 135},
        ])

    def test_parse_evolution_set_rejects_unknown_method_and_size(self) -> None:
        with self.assertRaisesRegex(ValueError, "Método de evolução desconhecido: 99"):
            parse_evolution_set(struct.pack("<3H", 99, 0, 1) + bytes(42))
        with self.assertRaisesRegex(ValueError, "esperado 48"):
            parse_evolution_set(bytes(40))

    def test_annotate_evolution_names_items_and_moves(self) -> None:
        items = ["None", "Fire Stone"]
        moves = ["—", "Pound"]
        self.assertEqual(annotate_evolution({"method": "use_item", "argument": 1, "species": 136}, items, moves)["itemName"], "Fire Stone")
        self.assertEqual(annotate_evolution({"method": "level_knows_move", "argument": 1, "species": 2}, items, moves)["moveName"], "Pound")
        self.assertNotIn("itemName", annotate_evolution({"method": "level", "argument": 16, "species": 253}, items, moves))

    def test_build_natures_uses_canonical_index_order(self) -> None:
        natures = build_natures([f"N{i}" for i in range(26)])
        self.assertEqual(len(natures), 25)
        self.assertEqual((natures[3]["increased"], natures[3]["decreased"]), ("atk", "spa"))
        self.assertEqual((natures[10]["increased"], natures[10]["decreased"]), ("spe", "atk"))
        self.assertIsNone(natures[12]["increased"])


def build_bcsar(sounds: list[tuple[str, str | None]]) -> bytes:
    """BCSAR mínimo: STRG com rótulos e INFO com tabela de sons + tabela de arquivos (externos)."""
    labels = [label for label, _ in sounds]
    strg_table = struct.pack("<I", len(labels))
    blob = b""
    entries_size = 4 + 12 * len(labels)
    for label in labels:
        raw = label.encode() + b"\0"
        strg_table += struct.pack("<HHiI", 0x1F01, 0, entries_size + len(blob), len(raw))
        blob += raw
    strg_body = struct.pack("<HHi", 0x2400, 0, 8) + strg_table + blob
    strg = b"STRG" + struct.pack("<I", 8 + len(strg_body)) + strg_body

    count = len(sounds)
    sound_table_size = 4 + 8 * count
    sound_entry_size = 28
    sound_table = struct.pack("<I", count)
    for i in range(count):
        sound_table += struct.pack("<HHi", 0x2200, 0, sound_table_size + i * sound_entry_size)
    for i in range(count):
        sound_table += struct.pack("<IIB3x", i, 0, 100) + struct.pack("<HHi", 0x2201, 0, 0) + struct.pack("<II", 1, i)
    file_table = struct.pack("<I", count)
    file_entries = b""
    file_table_size = 4 + 8 * count
    for _, file_name in sounds:
        file_table += struct.pack("<HHi", 0x220D, 0, file_table_size + len(file_entries))
        name = (file_name or "").encode() + b"\0"
        kind = 0x220D if file_name else 0x220C
        entry = struct.pack("<HHi", kind, 0, 8) + name
        file_entries += entry + b"\0" * (-len(entry) % 4)
    file_table += file_entries
    refs_size = 8 * 8
    info_body = struct.pack("<HHi", 0x2100, 0, refs_size) + struct.pack("<HHi", 0x2106, 0, refs_size + len(sound_table))
    info_body += b"\0" * (refs_size - len(info_body)) + sound_table + file_table
    info = b"INFO" + struct.pack("<I", 8 + len(info_body)) + info_body

    strg_offset = 0x40
    info_offset = strg_offset + len(strg)
    header = struct.pack("<4sHHIIH2x", b"CSAR", 0xFEFF, 0x40, 0x02030100, info_offset + len(info), 2)
    header += struct.pack("<HHII", 0x2000, 0, strg_offset, len(strg)) + struct.pack("<HHII", 0x2001, 0, info_offset, len(info))
    return header + b"\0" * (strg_offset - len(header)) + strg + info


class ZoneAudioTest(unittest.TestCase):
    SOUNDS = [
        ("STRM_BGM_SILENCE", "bgm_xy_silence.dspadpcm.bcstm"),
        ("STRM_BGM_T_01", "bgm_sg_t_01.dspadpcm.bcstm"),
        ("STRM_BGM_R_A", "bgm_sg_r_a.dspadpcm.bcstm"),
        ("SEQ_SE_DUMMY", None),
    ]

    def test_parse_bcsar_sounds_maps_index_to_label_and_external_file(self) -> None:
        sounds = parse_bcsar_sounds(build_bcsar(self.SOUNDS))
        self.assertEqual([s["label"] for s in sounds], [label for label, _ in self.SOUNDS])
        self.assertEqual(sounds[1]["file"], "bgm_sg_t_01.dspadpcm.bcstm")
        self.assertIsNone(sounds[3]["file"])

    def test_parse_bcsar_rejects_other_magic(self) -> None:
        with self.assertRaisesRegex(ValueError, "não é BCSAR"):
            parse_bcsar_sounds(b"CWAR" + bytes(60))

    def test_read_zone_bgm_table_follows_bcsar_path_in_code(self) -> None:
        code = b"\0" * 16 + b"rom:/sound/sango_sound.bcsar\0" + b"\0" * 7 + struct.pack("<3I", 0x01000002, 0x01000001, 0x03000000)
        self.assertEqual(read_zone_bgm_table(code), [2, 1])
        with self.assertRaisesRegex(ValueError, "não encontrado"):
            read_zone_bgm_table(b"\0" * 64)

    def test_build_zone_audio_chains_zone_index_table_and_sounds(self) -> None:
        zone_data = b"".join(struct.pack("<8xH46x", index) for index in (1, 0, 7))
        entries = build_zone_audio(
            read_zone_bgm_indexes(zone_data),
            [2, 1],
            parse_bcsar_sounds(build_bcsar(self.SOUNDS)),
            {0: "Littleroot Town", 1: "Route 101"},
            {"bgm_sg_t_01"},
        )
        self.assertEqual(entries[0], {"zone": 0, "name": "Littleroot Town", "bgmIndex": 1, "soundIndex": 1,
                                      "soundLabel": "STRM_BGM_T_01", "bgmName": "bgm_sg_t_01", "hasMp3": True})
        self.assertEqual((entries[1]["bgmName"], entries[1]["hasMp3"]), ("bgm_sg_r_a", False))
        self.assertIsNone(entries[2]["soundIndex"])


def build_glb(materials: list[dict[str, object]]) -> bytes:
    payload = json.dumps({"asset": {"version": "2.0"}, "materials": materials}).encode()
    payload += b" " * (-len(payload) % 4)
    total = 12 + 8 + len(payload)
    return struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(payload), b"JSON") + payload


class PicaMaterialConversionTest(unittest.TestCase):
    def test_parse_missing_textures_ignores_other_warnings(self) -> None:
        warnings = (
            "Material 'a' references missing texture 'chip_wind'.\n"
            "Material 'a' uses a standard shading fallback.\n"
            "Material 'b' references missing texture 'chip_wind'.\n"
            "Material 'b' references missing texture 't101_01'.\n"
        )
        self.assertEqual(parse_missing_textures(warnings), {"chip_wind", "t101_01"})

    def test_select_texture_archive_prefers_full_coverage_and_whole_names(self) -> None:
        archives = {
            "0004": b"\x00chip_wind\x00",
            "0008": b"\x00chip_wind\x00t101_01\x00",
            "0009": b"\x00chip_wind2\x00t101_012\x00",
        }
        self.assertEqual(select_texture_archive({"chip_wind", "t101_01"}, archives), "0008")

    def test_select_texture_archive_returns_none_without_any_match(self) -> None:
        self.assertIsNone(select_texture_archive({"x_tex"}, {"0001": b"nothing"}))

    def test_pica_alpha_state_blend_mask_and_opaque(self) -> None:
        blend = {"BlendFunction": {"ColorSrcFunc": "SourceAlpha"}, "AlphaTest": {"Enabled": True, "Reference": 0}}
        mask = {"BlendFunction": {"ColorSrcFunc": "One"}, "AlphaTest": {"Enabled": True, "Reference": 127}}
        opaque = {"BlendFunction": {"ColorSrcFunc": "One"}, "AlphaTest": {"Enabled": False, "Reference": 0}}
        self.assertEqual(pica_alpha_state(blend), ("BLEND", None))
        self.assertEqual(pica_alpha_state(mask), ("MASK", 128 / 255))
        self.assertEqual(pica_alpha_state(opaque), ("OPAQUE", None))

    def test_patch_glb_materials_sets_alpha_mode_and_marker(self) -> None:
        glb = build_glb([{"name": "shadow1"}, {"name": "t01_01"}, {"name": "sem_pica"}])
        states = {"shadow1": ("BLEND", None), "t01_01": ("MASK", 0.5)}
        patched = patch_glb_materials(glb, states)
        length = struct.unpack_from("<I", patched, 12)[0]
        doc = json.loads(patched[20 : 20 + length])
        shadow, wall, untouched = doc["materials"]
        self.assertEqual(shadow["alphaMode"], "BLEND")
        self.assertEqual(wall["alphaMode"], "MASK")
        self.assertEqual(wall["alphaCutoff"], 0.5)
        self.assertTrue(wall["extras"]["pica"])
        self.assertNotIn("extras", untouched)
        self.assertEqual(struct.unpack_from("<I", patched, 8)[0], len(patched))
        self.assertEqual(len(patched) % 4, 0)


if __name__ == "__main__":
    unittest.main()

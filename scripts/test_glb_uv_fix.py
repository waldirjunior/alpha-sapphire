#!/usr/bin/env python3
"""Testes do remap de texture.texCoord (glb_uv_fix) e do validador de GLBs."""

from __future__ import annotations

import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from glb_uv_fix import fix_file, read_glb
from validate_glb import validate_doc

PUBLIC_MAPS = Path(__file__).resolve().parent.parent / "public" / "assets" / "maps"


def build_glb(doc: dict) -> bytes:
    payload = json.dumps(doc).encode()
    payload += b" " * (-len(payload) % 4)
    total = 12 + 8 + len(payload)
    return (
        struct.pack("<4sII", b"glTF", 2, total)
        + struct.pack("<I4s", len(payload), b"JSON")
        + payload
    )


def make_doc(tex_coords: list[int | None], uv_sets: list[str]) -> dict:
    """GLB mínimo: um material por texCoord, uma primitiva por material."""
    materials = []
    primitives = []
    attributes = {name: i for i, name in enumerate(uv_sets)}
    attributes["POSITION"] = 99
    for index, tex_coord in enumerate(tex_coords):
        texture: dict = {"index": 0}
        if tex_coord is not None:
            texture["texCoord"] = tex_coord
        materials.append({
            "name": f"mat{index}",
            "pbrMetallicRoughness": {"baseColorTexture": texture},
        })
        primitives.append({"attributes": dict(attributes), "material": index})
    return {
        "asset": {"version": "2.0"},
        "materials": materials,
        "meshes": [{"primitives": primitives}],
        "textures": [{"source": 0}],
        "images": [{"uri": "tex.png"}],
    }


class UvRemapTest(unittest.TestCase):
    def fix(self, doc: dict) -> dict:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sample.glb"
            path.write_bytes(build_glb(doc))
            fix_file(path)
            out, _ = read_glb(path)
            return out

    def tex_coords(self, doc: dict) -> list[int]:
        return [
            m["pbrMetallicRoughness"]["baseColorTexture"].get("texCoord", 0)
            for m in doc["materials"]
        ]

    def test_sparse_pica_sets_remap_to_last_valid_channel(self) -> None:
        # assimp v6 grava set 3/4 do COLLADA mas só exporta TEXCOORD_0/1.
        doc = make_doc([3, 4], ["TEXCOORD_0", "TEXCOORD_1"])
        self.assertEqual(self.tex_coords(self.fix(doc)), [1, 1])

    def test_pica_diffuse_uses_raw_uv_zero_and_migrates_previous_remap(self) -> None:
        doc = make_doc([1, 3, 4], ["TEXCOORD_0", "TEXCOORD_1"])
        for material in doc["materials"]:
            material["extras"] = {"pica": True}
        doc["materials"][0]["normalTexture"] = {"index": 0, "texCoord": 1}
        fixed = self.fix(doc)
        self.assertEqual(self.tex_coords(fixed), [0, 0, 0])
        self.assertEqual(fixed["materials"][0]["normalTexture"]["texCoord"], 1)
        self.assertEqual(self.fix(fixed), fixed)

    def test_valid_texcoord_is_untouched(self) -> None:
        doc = make_doc([0, 1], ["TEXCOORD_0", "TEXCOORD_1"])
        self.assertEqual(self.tex_coords(self.fix(doc)), [0, 1])

    def test_single_uv_set_remaps_to_zero(self) -> None:
        doc = make_doc([3], ["TEXCOORD_0"])
        self.assertEqual(self.tex_coords(self.fix(doc)), [0])

    def test_missing_texcoord_is_untouched(self) -> None:
        doc = make_doc([None], ["TEXCOORD_0", "TEXCOORD_1"])
        self.assertEqual(self.tex_coords(self.fix(doc)), [0])


class ValidateGlbTest(unittest.TestCase):
    def validate(self, doc: dict) -> list[str]:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "sample.glb"
            path.write_bytes(build_glb(doc))
            return validate_doc(path)

    def test_flags_texcoord_beyond_available_sets(self) -> None:
        errors = self.validate(make_doc([3], ["TEXCOORD_0", "TEXCOORD_1"]))
        self.assertEqual(len(errors), 1)
        self.assertIn("texCoord=3", errors[0])

    def test_accepts_valid_doc(self) -> None:
        self.assertEqual(self.validate(make_doc([0, 1], ["TEXCOORD_0", "TEXCOORD_1"])), [])

    def test_staged_map_glbs_are_valid(self) -> None:
        import os
        maps_dir = Path(os.environ.get("GLB_MAPS_DIR", PUBLIC_MAPS))
        if not maps_dir.is_dir():
            self.skipTest("assets públicos não presentes neste checkout")
        errors: list[str] = []
        for path in sorted(maps_dir.glob("*/*.glb")):
            errors.extend(validate_doc(path))
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()

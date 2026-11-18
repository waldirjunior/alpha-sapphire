#!/usr/bin/env python3
"""Corrige texture.texCoord inválidos em .glb exportados pelo assimp v6.

O SpicaExport emite COLLADA com `<input semantic="TEXCOORD" set="N">` usando
números de set esparsos (0, 3, 4) vindos do PICA200. O assimp v6 compacta os
atributos de UV para TEXCOORD_0..k mas grava `texCoord` com o número de set
original; o three.js (r150+) usa `texCoord` como `texture.channel` e amostra um
atributo `uvN` inexistente — meshes renderizam cor plana (um único texel) ou o
shader falha (`uv4` undeclared). Verificado no DAE rom/extracted/models/
littleroot_town/littleroot_town.dae: os sets 3/4 referenciam fontes
`*_mapped_uv*_id`, i.e. os UVs "mapeados" que o assimp exporta como TEXCOORD_1 —
enquanto o .glb legado (assimp v5) usa canal 0 para os mesmos materiais e
renderiza corretamente.

Regra de remap (A-NNN/P-NNN ver docs): para cada material, o canal válido é o
maior índice TEXCOORD_n presente nas primitivas que usam o material. texCoord
acima desse limite é remapeado para o maior canal válido quando existem 2+
conjuntos de UV (o "mapped_uv" do PICA vive no último slot compactado); se a
primitiva só tem TEXCOORD_0, remapeia para 0.
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

GLB_MAGIC = b"glTF"


def read_glb(path: Path) -> tuple[dict, bytes]:
    blob = path.read_bytes()
    if blob[:4] != GLB_MAGIC:
        raise ValueError(f"{path}: não é um .glb (magic inválido)")
    json_len = struct.unpack_from("<I", blob, 12)[0]
    return json.loads(blob[20 : 20 + json_len]), blob


def write_glb(path: Path, doc: dict, blob: bytes) -> None:
    json_len = struct.unpack_from("<I", blob, 12)[0]
    payload = json.dumps(doc, separators=(",", ":")).encode()
    payload += b" " * (-len(payload) % 4)
    rest = blob[20 + json_len :]
    total = 12 + 8 + len(payload) + len(rest)
    out = (
        struct.pack("<4sII", GLB_MAGIC, 2, total)
        + struct.pack("<I4s", len(payload), b"JSON")
        + payload
        + rest
    )
    path.write_bytes(out)


def uv_channel_count(doc: dict, material_index: int) -> int:
    count = 0
    for mesh in doc.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if prim.get("material") != material_index:
                continue
            sets = [int(k.split("_")[1]) for k in prim.get("attributes", {}) if k.startswith("TEXCOORD_")]
            if sets:
                count = max(count, max(sets) + 1)
    return count


def iter_texture_infos(material: dict):
    pbr = material.get("pbrMetallicRoughness", {})
    for key in ("baseColorTexture", "metallicRoughnessTexture"):
        if key in pbr:
            yield pbr[key]
    for key in ("normalTexture", "occlusionTexture", "emissiveTexture"):
        if key in material:
            yield material[key]
    for ext in material.get("extensions", {}).values():
        if isinstance(ext, dict):
            for value in ext.values():
                if isinstance(value, dict) and "index" in value:
                    yield value


def fix_doc(doc: dict) -> list[str]:
    """Remapeia texCoord inválidos; retorna descrições das correções."""
    fixes: list[str] = []
    materials = doc.get("materials", [])
    for mat_index, material in enumerate(materials):
        valid = uv_channel_count(doc, mat_index)
        if valid == 0:
            continue
        for tex_info in iter_texture_infos(material):
            tex_coord = tex_info.get("texCoord")
            if tex_coord is None or tex_coord < valid:
                continue
            target = valid - 1
            fixes.append(
                f"material[{mat_index}] {material.get('name', '?')}: "
                f"texCoord {tex_coord} -> {target} (TEXCOORD_0..{valid - 1})"
            )
            tex_info["texCoord"] = target
    return fixes


def fix_file(path: Path, dry_run: bool = False) -> list[str]:
    doc, blob = read_glb(path)
    fixes = fix_doc(doc)
    if fixes and not dry_run:
        write_glb(path, doc, blob)
    return fixes


def main() -> int:
    parser = argparse.ArgumentParser(description="Remapeia texture.texCoord inválidos em .glb (assimp v6).")
    parser.add_argument("glb", nargs="+", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    status = 0
    for path in args.glb:
        try:
            fixes = fix_file(path, dry_run=args.dry_run)
        except (ValueError, struct.error, json.JSONDecodeError) as exc:
            print(f"ERRO {path}: {exc}", file=sys.stderr)
            status = 1
            continue
        tag = "remapearia" if args.dry_run else "corrigido"
        for fix in fixes:
            print(f"{tag} {path}: {fix}")
    return status


if __name__ == "__main__":
    sys.exit(main())

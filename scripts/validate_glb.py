#!/usr/bin/env python3
"""Valida que todo texture.texCoord referencia um conjunto TEXCOORD_n existente.

Para cada material, exige texCoord < número de conjuntos TEXCOORD_0..k presentes
nas primitivas que usam aquele material. Uso:

    python3 scripts/validate_glb.py arquivo.glb [outros.glb ...]
    python3 scripts/validate_glb.py --glob 'rom/extracted/models/gr_*/gr_*.glb'

Retorna 0 se todos válidos, 1 se houver violação ou arquivo ilegível.
"""

from __future__ import annotations

import argparse
import glob as globlib
import sys
from pathlib import Path

from glb_uv_fix import read_glb, iter_texture_infos, uv_channel_count


def validate_doc(path: Path) -> list[str]:
    doc, _ = read_glb(path)
    errors: list[str] = []
    for mat_index, material in enumerate(doc.get("materials", [])):
        valid = uv_channel_count(doc, mat_index)
        for tex_info in iter_texture_infos(material):
            tex_coord = tex_info.get("texCoord", 0)
            if valid == 0:
                errors.append(f"{path}: material[{mat_index}] {material.get('name')}: textura sem primitiva com TEXCOORD")
                continue
            if tex_coord >= valid:
                errors.append(
                    f"{path}: material[{mat_index}] {material.get('name')}: "
                    f"texCoord={tex_coord} >= {valid} conjuntos TEXCOORD"
                )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Valida texture.texCoord vs atributos TEXCOORD_n.")
    parser.add_argument("glb", nargs="*", type=Path)
    parser.add_argument("--glob", dest="pattern", default=None)
    args = parser.parse_args()

    paths = list(args.glb)
    if args.pattern:
        paths.extend(Path(p) for p in sorted(globlib.glob(args.pattern)))
    if not paths:
        print("nenhum .glb informado", file=sys.stderr)
        return 1

    total_errors: list[str] = []
    bad_files = 0
    for path in paths:
        try:
            errors = validate_doc(path)
        except Exception as exc:  # arquivo ilegível conta como inválido
            errors = [f"{path}: erro de leitura: {exc}"]
        total_errors.extend(errors)
        if errors:
            bad_files += 1

    for error in total_errors:
        print(error)
    print(f"{len(paths)} arquivo(s), {bad_files} inválido(s), {len(total_errors)} violação(ões)")
    return 0 if not total_errors else 1


if __name__ == "__main__":
    sys.exit(main())

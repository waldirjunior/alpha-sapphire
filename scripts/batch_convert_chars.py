#!/usr/bin/env python3
"""Converte todos os modelos MM de a/0/2/1 para .glb animado em lote.

Saída: rom/extracted/models/characters/mm_NNNN/ (ignorado pelo .gitignore).
Arquivos sem modelo H3D ou sem esqueleto são registrados como falha.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from convert_character_glb import convert_character


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch MM -> .glb animado.")
    parser.add_argument("--char-dir", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--jobs", type=int, default=4)
    args = parser.parse_args()

    todo = []
    for mm_path in sorted(args.char_dir.glob("*.bin")):
        name = f"mm_{mm_path.stem}"
        out_glb = args.out_dir / name / f"{name}.glb"
        if not out_glb.is_file():
            todo.append((mm_path, out_glb))

    print(f"{len(todo)} modelos MM para converter", flush=True)

    def worker(item):
        mm_path, out_glb = item
        t0 = time.time()
        try:
            convert_character(mm_path, out_glb)
            return (mm_path.stem, "ok", round(time.time() - t0, 1))
        except subprocess.CalledProcessError as e:
            return (mm_path.stem, f"erro:{e.returncode}", round(time.time() - t0, 1))
        except Exception as e:
            return (mm_path.stem, f"erro:{e}", round(time.time() - t0, 1))

    ok = fail = 0
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for stem, status, secs in pool.map(worker, todo):
            if status == "ok":
                ok += 1
            else:
                fail += 1
            print(f"[{ok + fail}/{len(todo)}] {stem} {status} {secs}s", flush=True)

    print(f"Concluído: {ok} ok, {fail} falhas")
    return 0


if __name__ == "__main__":
    sys.exit(main())

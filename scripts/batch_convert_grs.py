#!/usr/bin/env python3
"""Converte todos os GRs referenciados pelo catálogo de zonas para .glb.

Saída: rom/extracted/models/gr_NNNN/ (ignorado pelo .gitignore). Mapas
consumidos pelo jogo são copiados para public/assets/maps/ sob demanda.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from convert_gr_to_glb import convert_gr_to_glb


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch GR -> .glb via zones.json.")
    parser.add_argument("--catalog", required=True, type=Path, help="src/data/zones.json")
    parser.add_argument("--gr-dir", required=True, type=Path, help="rom/extracted/garc/a_0_3_9")
    parser.add_argument("--ad-dir", required=True, type=Path, help="rom/extracted/garc/a_0_1_4")
    parser.add_argument("--out-dir", required=True, type=Path, help="rom/extracted/models")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--jobs", type=int, default=4)
    args = parser.parse_args()

    zones = json.loads(args.catalog.read_text(encoding="utf-8"))["zones"]
    gr_ids = sorted({g for z in zones for g in z["grIds"]})
    if args.limit:
        gr_ids = gr_ids[: args.limit]

    todo = []
    for gr_id in gr_ids:
        gr_path = args.gr_dir / f"{gr_id:04d}.bin"
        out_glb = args.out_dir / f"gr_{gr_id:04d}" / f"gr_{gr_id:04d}.glb"
        if not gr_path.is_file():
            print(f"IGNORADO {gr_path} (não existe)", file=sys.stderr)
            continue
        if args.skip_existing and out_glb.is_file():
            continue
        todo.append((gr_path, out_glb))

    print(f"{len(todo)} GRs para converter (de {len(gr_ids)} no catálogo)")

    def worker(item):
        gr_path, out_glb = item
        t0 = time.time()
        try:
            convert_gr_to_glb(gr_path, out_glb, ad_dir=args.ad_dir)
            return (gr_path.stem, "ok", round(time.time() - t0, 1))
        except subprocess.CalledProcessError as e:
            return (gr_path.stem, f"erro:{e.returncode}", round(time.time() - t0, 1))
        except Exception as e:
            return (gr_path.stem, f"erro:{e}", round(time.time() - t0, 1))

    from concurrent.futures import ThreadPoolExecutor

    ok = fail = 0
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for stem, status, secs in pool.map(worker, todo):
            if status == "ok":
                ok += 1
            else:
                fail += 1
            print(f"[{ok + fail}/{len(todo)}] {stem} {status} {secs}s", flush=True)

    print(f"Concluído: {ok} ok, {fail} falhas")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

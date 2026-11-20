#!/usr/bin/env python3
"""Convert extracted CWAV samples to browser-playable PCM WAV files."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import wave
from pathlib import Path
from typing import Any


def convert_cwav_assets(input_dir: Path, output_dir: Path, decoder: str) -> dict[str, Any]:
    manifest_path = input_dir / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Manifest BCSAR ausente: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = [asset for asset in manifest.get("assets", []) if asset.get("signature") == "CWAV"]
    output_dir.mkdir(parents=True, exist_ok=True)
    converted = [convert_one(asset, input_dir, output_dir, decoder) for asset in assets]
    result = {"convertedCount": len(converted), "assets": converted}
    (output_dir / "conversion-manifest.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    return result


def convert_one(asset: dict[str, Any], input_dir: Path, output_dir: Path, decoder: str) -> dict[str, Any]:
    relative_source = Path(str(asset.get("path", "")))
    source = (input_dir / relative_source).resolve()
    if not relative_source.name or not source.is_relative_to(input_dir.resolve()) or not source.is_file():
        raise ValueError(f"CWAV de origem ausente ou fora do diretório: {asset.get('path')!r}")
    relative_output = relative_source.with_suffix(".wav")
    output = output_dir / relative_output
    output.parent.mkdir(parents=True, exist_ok=True)
    decode_with_vgmstream(decoder, source, output)
    validate_wave(output, source)
    return {
        "fileId": asset.get("fileId"),
        "source": relative_source.as_posix(),
        "path": relative_output.as_posix(),
        "sourceSize": source.stat().st_size,
        "size": output.stat().st_size,
    }


def decode_with_vgmstream(decoder: str, source: Path, output: Path) -> None:
    try:
        result = subprocess.run(
            [decoder, "-o", str(output), str(source)], capture_output=True, text=True, check=False,
        )
    except FileNotFoundError as error:
        raise RuntimeError(f"decoder '{decoder}' não encontrado; instale vgmstream-cli") from error
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip() or f"código {result.returncode}"
        raise RuntimeError(f"Falha ao converter {source.name}: {detail}")


def validate_wave(path: Path, source: Path) -> None:
    try:
        with wave.open(str(path), "rb") as decoded:
            if decoded.getnchannels() < 1 or decoded.getframerate() < 1 or decoded.getnframes() < 1:
                raise ValueError("cabeçalho sem canais, frequência ou frames")
    except (OSError, EOFError, wave.Error) as error:
        raise ValueError(f"WAV inválido gerado para {source.name}: {error}") from error
    except ValueError as error:
        raise ValueError(f"WAV inválido gerado para {source.name}: {error}") from error


def main() -> int:
    parser = argparse.ArgumentParser(description="Converte os CWAVs extraídos para WAV PCM.")
    parser.add_argument("--input-dir", type=Path, default=Path("rom/extracted/audio/bcsar_sfx"))
    parser.add_argument("--out-dir", type=Path, default=Path("rom/extracted/audio/bcsar_sfx/wav"))
    parser.add_argument("--decoder", default="vgmstream-cli")
    args = parser.parse_args()
    result = convert_cwav_assets(args.input_dir, args.out_dir, args.decoder)
    print(f"cwav_convertidos={result['convertedCount']} -> {args.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

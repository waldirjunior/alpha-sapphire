#!/usr/bin/env python3
"""Convert extracted CWAV samples to browser-playable PCM WAV files."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path
from typing import Any


def convert_cwav_assets(
    input_dir: Path,
    output_dir: Path,
    decoder: str,
    output_names: dict[str, str] | None = None,
) -> dict[str, Any]:
    manifest_path = input_dir / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Manifest BCSAR ausente: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = [asset for asset in manifest.get("assets", []) if asset.get("signature") == "CWAV"]
    if output_names is not None:
        assets = [asset for asset in assets if asset.get("path") in output_names]
        found_paths = {str(asset.get("path")) for asset in assets}
        missing_paths = set(output_names) - found_paths
        if missing_paths:
            raise ValueError(f"CWAV ausente no manifesto: {', '.join(sorted(missing_paths))}")
    output_dir.mkdir(parents=True, exist_ok=True)
    converted = [convert_one(asset, input_dir, output_dir, decoder, output_names) for asset in assets]
    result = {"convertedCount": len(converted), "assets": converted}
    (output_dir / "conversion-manifest.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    return result


def convert_one(
    asset: dict[str, Any],
    input_dir: Path,
    output_dir: Path,
    decoder: str,
    output_names: dict[str, str] | None,
) -> dict[str, Any]:
    relative_source = Path(str(asset.get("path", "")))
    source = (input_dir / relative_source).resolve()
    if not relative_source.name or not source.is_relative_to(input_dir.resolve()) or not source.is_file():
        raise ValueError(f"CWAV de origem ausente ou fora do diretório: {asset.get('path')!r}")
    output_name = output_names.get(relative_source.as_posix()) if output_names is not None else None
    relative_output = Path(output_name) if output_name else relative_source.with_suffix(".wav")
    if relative_output.name != str(relative_output) or relative_output.suffix.lower() != ".wav":
        raise ValueError(f"Nome de WAV deve ser basename .wav: {relative_output}")
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
    with tempfile.TemporaryDirectory(prefix="bcsar-cwav-") as temporary_dir:
        decoder_source = Path(temporary_dir) / "input.bcwav"
        shutil.copyfile(source, decoder_source)
        try:
            result = subprocess.run(
                [decoder, "-i", "-o", str(output), str(decoder_source)], capture_output=True, text=True, check=False,
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
    parser.add_argument(
        "--asset", action="append", default=[], metavar="SOURCE=OUTPUT.wav",
        help="converte um CWAV específico e escolhe nome de saída (repetível)",
    )
    args = parser.parse_args()
    output_names = dict(parse_asset_argument(specification) for specification in args.asset) if args.asset else None
    result = convert_cwav_assets(args.input_dir, args.out_dir, args.decoder, output_names)
    print(f"cwav_convertidos={result['convertedCount']} -> {args.out_dir}")
    return 0


def parse_asset_argument(specification: str) -> tuple[str, str]:
    source, separator, output = specification.partition("=")
    if not separator or not source or not output:
        raise ValueError(f"--asset inválido {specification!r}; use SOURCE=OUTPUT.wav")
    return source, output


if __name__ == "__main__":
    sys.exit(main())

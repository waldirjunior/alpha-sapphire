#!/usr/bin/env python3
"""Convert extracted CWAV samples to browser-playable PCM WAV files."""

from __future__ import annotations

import argparse
import json
import shutil
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path
from typing import Any

if __package__:
    from scripts.extract_bcsar_sfx import (
        INFO_FILE_TABLE,
        INFO_SOUND_TABLE,
        read_info_tables,
        read_ref,
        read_ref_table,
        read_sections,
    )
else:
    from extract_bcsar_sfx import (
        INFO_FILE_TABLE,
        INFO_SOUND_TABLE,
        read_info_tables,
        read_ref,
        read_ref_table,
        read_sections,
    )


SEQUENCE_BANK_REFERENCE_OFFSETS = (0x10, 0x74)
PRIORITY_SEPLAY_LABELS = {
    "SEQ_SE_MESSAGE", "SEQ_SE_SYS_006", "SEQ_SE_SYS_066", "SEQ_SE_FLD_KAIDAN",
}


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


def read_sequence_bank_item_ids(detail: bytes) -> list[int]:
    if len(detail) < max(SEQUENCE_BANK_REFERENCE_OFFSETS) + 4:
        raise ValueError(f"Detalhe CSEQ truncado: precisa de pelo menos 0x78 bytes, recebeu {len(detail):#x}")
    bank_ids = []
    for offset in SEQUENCE_BANK_REFERENCE_OFFSETS:
        item_id = struct.unpack_from("<I", detail, offset)[0]
        if item_id >> 24 == 0x03 and (item_id & 0x00FFFFFF) not in bank_ids:
            bank_ids.append(item_id & 0x00FFFFFF)
    return bank_ids


def classify_cwav_candidates(paths: list[str]) -> str:
    count = len(set(paths))
    if count == 1:
        return "unique"
    return "ambiguous" if count > 1 else "missing"


def resolve_seplay_cwav_candidates(
    bcsar_data: bytes,
    input_dir: Path,
    seplay_map: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    manifest_path = input_dir / "manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Manifest BCSAR ausente: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    cwavs = [asset for asset in manifest.get("assets", []) if asset.get("signature") == "CWAV"]
    sections = read_sections(bcsar_data)
    tables = read_info_tables(bcsar_data, sections[0x2001][0])
    sound_refs = read_ref_table(bcsar_data, tables[INFO_SOUND_TABLE], "BCSAR sounds")
    bank_refs = read_ref_table(bcsar_data, tables[0x2101], "BCSAR banks")
    archive_refs = read_ref_table(bcsar_data, tables[0x2103], "BCSAR wave archives")
    return [
        resolve_one_seplay_chain(
            literal, mapping, bcsar_data, input_dir, cwavs, sound_refs, bank_refs, archive_refs,
        )
        for literal, mapping in sorted(seplay_map.items())
    ]


def resolve_one_seplay_chain(
    literal: str,
    mapping: dict[str, Any],
    bcsar_data: bytes,
    input_dir: Path,
    cwavs: list[dict[str, Any]],
    sound_refs: list[tuple[int, int]],
    bank_refs: list[tuple[int, int]],
    archive_refs: list[tuple[int, int]],
) -> dict[str, Any]:
    sound_index = int(mapping["bcsarIndex"])
    if sound_index >= len(sound_refs):
        raise ValueError(f"{literal} aponta a BCSAR {sound_index}, fora de {len(sound_refs)} sons")
    sound_type, sound_entry = sound_refs[sound_index]
    if sound_type != 0x2200:
        raise ValueError(f"Som BCSAR {sound_index} usa referência inesperada {sound_type:#06x}")
    sequence_file_id = struct.unpack_from("<I", bcsar_data, sound_entry)[0]
    detail_type, detail_offset = read_ref(bcsar_data, sound_entry + 12, f"SEPlay {literal} detail")
    if detail_type != 0x2203:
        return empty_chain_row(literal, mapping, sequence_file_id, "som BCSAR não é CSEQ")
    bcsar_file_payload(bcsar_data, sequence_file_id, "CSEQ")
    bank_indexes = read_sequence_bank_item_ids(bcsar_data[detail_offset:detail_offset + 0x78])
    candidates = []
    for bank_index in bank_indexes:
        if bank_index >= len(bank_refs):
            raise ValueError(f"CSEQ {sequence_file_id} referencia bank item {bank_index} fora de {len(bank_refs)}")
        _reference_type, bank_entry = bank_refs[bank_index]
        bank_file_id = struct.unpack_from("<I", bcsar_data, bank_entry)[0]
        bank = bcsar_file_payload(bcsar_data, bank_file_id, "CBNK")
        for archive_index in read_bank_wave_archive_ids(bank):
            if archive_index >= len(archive_refs):
                raise ValueError(f"CBNK {bank_file_id} referencia wave archive {archive_index} fora de {len(archive_refs)}")
            _archive_type, archive_entry = archive_refs[archive_index]
            cwar_file_id = struct.unpack_from("<I", bcsar_data, archive_entry)[0]
            bcsar_file_payload(bcsar_data, cwar_file_id, "CWAR")
            for asset in cwavs:
                if asset.get("fileId") != cwar_file_id:
                    continue
                source = str(asset.get("path", ""))
                if source and cwav_source_exists(input_dir, source):
                    candidates.append({
                        "bankIndex": bank_index,
                        "bankFileId": bank_file_id,
                        "waveArchiveIndex": archive_index,
                        "cwarFileId": cwar_file_id,
                        "cwavPath": source,
                    })
    status = classify_cwav_candidates([str(candidate["cwavPath"]) for candidate in candidates])
    return {
        "literalHex": literal,
        "bcsarIndex": sound_index,
        "label": mapping["label"],
        "sequenceFileId": sequence_file_id,
        "status": status,
        "candidates": candidates,
    }


def bcsar_file_payload(bcsar_data: bytes, file_id: int, expected: str) -> bytes:
    sections = read_sections(bcsar_data)
    tables = read_info_tables(bcsar_data, sections[0x2001][0])
    file_refs = read_ref_table(bcsar_data, tables[INFO_FILE_TABLE], "BCSAR files")
    if file_id >= len(file_refs):
        raise ValueError(f"BCSAR fileId {file_id} fora de {len(file_refs)} arquivos")
    reference_type, descriptor = file_refs[file_id]
    if reference_type != 0x220A:
        raise ValueError(f"BCSAR fileId {file_id} usa referência inesperada {reference_type:#06x}")
    payload_type, payload_offset = read_ref(bcsar_data, descriptor, f"BCSAR fileId {file_id}")
    if payload_type != 0x220C:
        raise ValueError(f"BCSAR fileId {file_id} não é interno: tipo {payload_type:#06x}")
    _data_type, _padding, relative, size = struct.unpack_from("<HHiI", bcsar_data, payload_offset)
    file_section_offset = sections[0x2002][0]
    payload_start = file_section_offset + 8 + relative
    payload = bcsar_data[payload_start:payload_start + size]
    if len(payload) != size or payload[:4].decode("ascii", errors="replace") != expected:
        raise ValueError(f"BCSAR fileId {file_id} deveria conter {expected}")
    return payload


def read_bank_wave_archive_ids(bank: bytes) -> list[int]:
    if bank[:4] != b"CBNK":
        raise ValueError(f"Payload de banco não é CBNK: {bank[:4]!r}")
    archive_ids = []
    for offset in range(0x20, len(bank) - 3, 4):
        item_id = struct.unpack_from("<I", bank, offset)[0]
        archive_index = item_id & 0x00FFFFFF
        if item_id >> 24 == 0x05 and archive_index not in archive_ids:
            archive_ids.append(archive_index)
    return archive_ids


def cwav_source_exists(input_dir: Path, source: str) -> bool:
    relative = Path(source)
    resolved = (input_dir / relative).resolve()
    return bool(relative.name and resolved.is_relative_to(input_dir.resolve()) and resolved.is_file())


def empty_chain_row(
    literal: str, mapping: dict[str, Any], sequence_file_id: int, reason: str,
) -> dict[str, Any]:
    return {
        "literalHex": literal,
        "bcsarIndex": mapping["bcsarIndex"],
        "label": mapping["label"],
        "sequenceFileId": sequence_file_id,
        "status": "missing",
        "reason": reason,
        "candidates": [],
    }


def build_seplay_sample_catalog(
    rows: list[dict[str, Any]], converted_outputs: set[tuple[int, str]],
) -> dict[str, dict[str, str]]:
    catalog = {}
    for row in rows:
        candidates = row["candidates"]
        paths = {str(candidate["cwavPath"]) for candidate in candidates}
        index = int(row["bcsarIndex"])
        if row["status"] != "unique" or len(paths) != 1 or (index, next(iter(paths))) not in converted_outputs:
            continue
        label = str(row["label"])
        catalog[str(index)] = {
            "label": label,
            "url": f"/assets/audio/sfx/bcsar_{index}_{label}.wav",
        }
    return dict(sorted(catalog.items(), key=lambda item: int(item[0])))


def convert_seplay_cwav_samples(
    bcsar_path: Path,
    input_dir: Path,
    output_dir: Path,
    decoder: str,
    seplay_map_path: Path,
    catalog_path: Path | None = None,
) -> dict[str, Any]:
    seplay_map = json.loads(seplay_map_path.read_text(encoding="utf-8"))
    rows = resolve_seplay_cwav_candidates(bcsar_path.read_bytes(), input_dir, seplay_map)
    converted_outputs: set[tuple[int, str]] = set()
    attempted_outputs: set[tuple[int, str, str]] = set()
    converted = []
    failures = []
    output_dir.mkdir(parents=True, exist_ok=True)
    for row in rows:
        if row["status"] != "unique" and row["label"] not in PRIORITY_SEPLAY_LABELS:
            continue
        for candidate in row["candidates"]:
            source = str(candidate["cwavPath"])
            output_name = seplay_output_name(row, candidate, source)
            output_key = (int(row["bcsarIndex"]), source, output_name)
            if output_key in attempted_outputs:
                continue
            attempted_outputs.add(output_key)
            asset = {"fileId": candidate["cwarFileId"], "signature": "CWAV", "path": source}
            try:
                result = convert_one(asset, input_dir, output_dir, decoder, {source: output_name})
                converted.append(result)
                if result["audiblePcm"] and row["status"] == "unique":
                    converted_outputs.add((int(row["bcsarIndex"]), source))
                elif not result["audiblePcm"]:
                    failures.append({"literalHex": row["literalHex"], "source": source,
                                     "error": "WAV PCM sem amplitude audível"})
            except (OSError, RuntimeError, ValueError) as error:
                failures.append({"literalHex": row["literalHex"], "source": source, "error": str(error)})
    catalog = build_seplay_sample_catalog(rows, converted_outputs)
    if catalog_path:
        catalog_path.parent.mkdir(parents=True, exist_ok=True)
        catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    result = {"convertedCount": len(converted), "assets": converted, "failures": failures, "chains": rows}
    (output_dir / "seplay-cwav-manifest.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    return result


def seplay_output_name(row: dict[str, Any], candidate: dict[str, Any], source: str) -> str:
    index = int(row["bcsarIndex"])
    label = str(row["label"])
    if row["status"] == "unique":
        return f"bcsar_{index}_{label}.wav"
    return f"bcsar_{index}_{label}_bank{candidate['bankIndex']}_{Path(source).stem}.wav"


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
    metrics = wave_metrics(output)
    return {
        "fileId": asset.get("fileId"),
        "source": relative_source.as_posix(),
        "path": relative_output.as_posix(),
        "sourceSize": source.stat().st_size,
        "size": output.stat().st_size,
        **metrics,
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


def wave_metrics(path: Path) -> dict[str, int | bool]:
    with wave.open(str(path), "rb") as decoded:
        width = decoded.getsampwidth()
        frames = decoded.readframes(decoded.getnframes())
        if width == 1:
            peak = max((abs(value - 128) for value in frames), default=0)
        else:
            peak = max((abs(int.from_bytes(frames[pos:pos + width], "little", signed=True))
                        for pos in range(0, len(frames), width)), default=0)
        return {
            "channels": decoded.getnchannels(),
            "sampleRate": decoded.getframerate(),
            "frames": decoded.getnframes(),
            "peak": peak,
            "audiblePcm": peak > 0,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Converte os CWAVs extraídos para WAV PCM.")
    parser.add_argument("--input-dir", type=Path, default=Path("rom/extracted/audio/bcsar_sfx"))
    parser.add_argument("--out-dir", type=Path, default=Path("rom/extracted/audio/bcsar_sfx/wav"))
    parser.add_argument("--decoder", default="vgmstream-cli")
    parser.add_argument("--bcsar", type=Path, help="resolve as cadeias CSEQ → CBNK → CWAR → CWAV")
    parser.add_argument("--seplay-map", type=Path, help="lookup literal exportado por inspect_audio_dispatch.py")
    parser.add_argument("--catalog-out", type=Path, help="catálogo de WAVs com cadeia única e conversão válida")
    parser.add_argument(
        "--asset", action="append", default=[], metavar="SOURCE=OUTPUT.wav",
        help="converte um CWAV específico e escolhe nome de saída (repetível)",
    )
    args = parser.parse_args()
    output_names = dict(parse_asset_argument(specification) for specification in args.asset) if args.asset else None
    if args.seplay_map:
        if not args.bcsar:
            parser.error("--seplay-map requer --bcsar para validar a cadeia BCSAR")
        result = convert_seplay_cwav_samples(
            args.bcsar, args.input_dir, args.out_dir, args.decoder, args.seplay_map, args.catalog_out,
        )
        print(
            f"cwav_convertidos={result['convertedCount']} falhas={len(result['failures'])} "
            f"-> {args.out_dir}"
        )
        return 0
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

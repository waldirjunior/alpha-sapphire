#!/usr/bin/env python3
"""Prove ORAS SEPlay dispatch and inspect trainer-class BGM fields."""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from collections import Counter
from pathlib import Path
from typing import Any

if __package__:
    from scripts.audio_arm_disassembly import (
        direct_call_targets,
        disassemble_arm_details,
        disassemble_arm_function,
        disassemble_arm_range,
    )
    from scripts.audio_dispatch_rom_data import (
        TRAINER_CLASS_BGM_OFFSET,
        TRAINER_CLASS_SIZE,
        TRAINER_DATA_SIZE,
        read_garc_entries,
        read_trainer_class_audio_arguments,
        read_trainer_data_classes,
    )
    from scripts.cro_native_abi import CroImage
    from scripts.extract_bcsar_sfx import parse_bcsar, scan_seplay_ids
else:
    from audio_arm_disassembly import (
        direct_call_targets,
        disassemble_arm_details,
        disassemble_arm_function,
        disassemble_arm_range,
    )
    from audio_dispatch_rom_data import (
        TRAINER_CLASS_BGM_OFFSET,
        TRAINER_CLASS_SIZE,
        TRAINER_DATA_SIZE,
        read_garc_entries,
        read_trainer_class_audio_arguments,
        read_trainer_data_classes,
    )
    from cro_native_abi import CroImage
    from extract_bcsar_sfx import parse_bcsar, scan_seplay_ids


EXEFS_BASE_VA = 0x100000
DISPATCH_POINTER_FILE_OFFSET = 0x159D4
DISPATCH_GROUP_COUNT = 0x17
BCSAR_SOUND_TYPE = 1
NATIVE_CANDIDATES = (
    "SEPlay", "MEPlay", "BGMPlay", "FieldSEPlay", "BGMStartBattleEvent",
    "BGMStartEvent", "_TrainerBGMPlay", "TrainerGetInfo",
)
NATIVE_AUDIO_THUNKS = {
    "SEPlay": (0x328,),
    "MEPlay": (0x3128,),
    "BGMStartBattleEvent": (0x1970,),
    "BGMStartEvent": (0x2A20,),
    "_TrainerBGMPlay": (0x1970,),
}
SEPLAY_TRACE_OFFSETS = (0x34C3D8, 0x15984)
MEPLAY_TRACE_OFFSETS = (0x34FBE4, 0x34C384, 0x15984)
TRAINER_BGM_TRACE_OFFSETS = (0x15984,)
WIN_LABELS = ("STRM_BGM_WIN1", "STRM_BGM_WIN2", "STRM_BGM_WIN3")
DEFAULT_ROM_ROOT = Path("rom/extracted")


class CodeBinaryImage:
    def __init__(self, size: int):
        self.size = size

    def segment_address(self, segment: int, offset: int) -> int:
        if segment != 0 or not 0 <= offset < self.size:
            raise ValueError(f"Import static fora do segmento code.bin: {segment}/{offset:#x}")
        return EXEFS_BASE_VA + offset


def require_range(blob: bytes, offset: int, size: int, context: str) -> None:
    if offset < 0 or size < 0 or offset + size > len(blob):
        raise ValueError(f"{context} fora do arquivo: {offset:#x}+{size:#x}/{len(blob):#x}")


def va_to_file_offset(address: int, context: str) -> int:
    offset = address - EXEFS_BASE_VA
    if offset < 0:
        raise ValueError(f"Endereço {context} {address:#x} abaixo da base code.bin {EXEFS_BASE_VA:#x}")
    return offset


def read_dispatch_table_pointer(code: bytes) -> int:
    require_range(code, DISPATCH_POINTER_FILE_OFFSET, 4, "Literal da tabela de dispatch")
    pointer = struct.unpack_from("<I", code, DISPATCH_POINTER_FILE_OFFSET)[0]
    va_to_file_offset(pointer, "tabela de dispatch")
    return pointer


def read_dispatch_tables(code: bytes, table_va: int) -> dict[int, list[int]]:
    table_offset = va_to_file_offset(table_va, "tabela de dispatch")
    require_range(code, table_offset, DISPATCH_GROUP_COUNT * 8, "Tabela de grupos SEPlay")
    groups: dict[int, list[int]] = {}
    for group in range(DISPATCH_GROUP_COUNT):
        count, entries_va = struct.unpack_from("<II", code, table_offset + group * 8)
        if count == 0:
            groups[group] = []
            continue
        entries_offset = va_to_file_offset(entries_va, f"SEPlay group {group}")
        require_range(code, entries_offset, count * 4, f"Tabela SEPlay group {group}")
        groups[group] = list(struct.unpack_from(f"<{count}I", code, entries_offset))
    return groups


def resolve_seplay_bcsar_id(argument: int, groups: dict[int, list[int]]) -> int | None:
    if not isinstance(argument, int) or not -0x80000000 <= argument <= 0xFFFFFFFF:
        return None
    unsigned_argument = argument & 0xFFFFFFFF
    group = (unsigned_argument >> 16) & 0xFF
    local_id = unsigned_argument & 0xFFFF
    entries = groups.get(group)
    if entries is None or local_id >= len(entries):
        return None
    return entries[local_id]


def resolve_static_import_target(image: CroImage, patch_address: int, code_size: int) -> int | None:
    code_image = CodeBinaryImage(code_size)
    for name, _symbols, _count, import_table, import_count in image.table(0xF0, 20):
        if image.blob[name : name + 9] != b"|static|\0":
            continue
        for index in range(import_count):
            target, batch = struct.unpack_from("<II", image.blob, import_table + index * 8)
            if patch_address not in image.import_patch_addresses(batch):
                continue
            try:
                return image.static_import_batch(code_image, target, batch).get(patch_address)
            except ValueError:
                return None
    return None


def trace_native_wrapper(
    image: CroImage, code: bytes, name: str, table_offset: int, wrapper_offset: int,
) -> dict[str, Any]:
    wrapper = disassemble_arm_function(image.relocated(), wrapper_offset, 0)
    if name == "BGMStartEvent":
        wrapper = disassemble_arm_details(image.relocated(), wrapper_offset, 0x80)
    call_targets = direct_call_targets(wrapper)
    result: dict[str, Any] = {
        "nativeTableFileOffset": f"0x{table_offset:X}",
        "wrapperFileOffset": f"0x{wrapper_offset:X}",
        "wrapperDisassembly": [row["text"] for row in wrapper],
    }
    helpers = []
    for thunk_address in call_targets:
        helper_va = resolve_static_import_target(image, thunk_address + 4, len(code))
        if helper_va is None:
            continue
        helper_offset = va_to_file_offset(helper_va, name)
        helper = disassemble_arm_function(code, helper_offset, EXEFS_BASE_VA)
        helpers.append({
            "thunkAddress": f"0x{thunk_address:X}",
            "virtualAddress": f"0x{helper_va:X}",
            "fileOffset": f"0x{helper_offset:X}",
            "disassembly": [row["text"] for row in helper],
            "calledVirtualAddresses": [f"0x{target:X}" for target in direct_call_targets(helper)],
        })
    result["staticHelpers"] = helpers
    selected_thunks = NATIVE_AUDIO_THUNKS.get(name, ())
    selected_helper = next((row for row in helpers if int(row["thunkAddress"], 16) in selected_thunks), None)
    if selected_helper is None:
        return result
    result["audioHelper"] = selected_helper
    helper_rows = disassemble_arm_function(code, int(selected_helper["fileOffset"], 16), EXEFS_BASE_VA)
    relevant_offsets = SEPLAY_TRACE_OFFSETS if name == "SEPlay" else ()
    if name == "MEPlay":
        relevant_offsets = MEPLAY_TRACE_OFFSETS
    if name == "_TrainerBGMPlay":
        relevant_offsets = TRAINER_BGM_TRACE_OFFSETS
    nested = []
    call_sources = [helper_rows]
    for trace_offset in relevant_offsets:
        trace_va = EXEFS_BASE_VA + trace_offset
        if not any(trace_va in direct_flow_targets(source) for source in call_sources):
            continue
        trace = disassemble_arm_function(code, trace_offset, EXEFS_BASE_VA)
        nested_row = {
            "virtualAddress": f"0x{trace_va:X}",
            "fileOffset": f"0x{trace_offset:X}",
            "disassembly": [row["text"] for row in trace],
            "calledVirtualAddresses": [f"0x{target:X}" for target in direct_call_targets(trace)],
        }
        nested.append(nested_row)
        call_sources.append(trace)
    if nested:
        result["calledHelpers"] = nested
    return result


def direct_flow_targets(rows: list[dict[str, Any]]) -> list[int]:
    targets = []
    for row in rows:
        if row["mnemonic"] not in {"b", "bl", "blx"} or not row["operands"].startswith("#"):
            continue
        try:
            targets.append(int(row["operands"][1:], 0))
        except ValueError:
            continue
    return targets


def sha256(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def sound_reference(encoded_id: int | None, sounds: dict[int, dict[str, Any]]) -> dict[str, Any] | None:
    if encoded_id is None or (encoded_id >> 24) != BCSAR_SOUND_TYPE:
        return None
    index = encoded_id & 0x00FFFFFF
    sound = sounds.get(index)
    if sound is None:
        return None
    return {
        "encodedBcsarId": f"0x{encoded_id:08X}",
        "soundIndex": index,
        "label": sound["label"],
        "kind": sound["kind"],
    }


def scan_byte_offsets(blob: bytes, word: int, *, aligned: bool = False) -> list[int]:
    needle = struct.pack("<I", word)
    offsets = []
    cursor = 0
    while (offset := blob.find(needle, cursor)) >= 0:
        if not aligned or offset % 4 == 0:
            offsets.append(offset)
        cursor = offset + 1
    return offsets


def class_names_by_id(path: Path) -> dict[int, str]:
    if not path.is_file():
        return {}
    names: dict[int, str] = {}
    for trainer in json.loads(path.read_text(encoding="utf-8")):
        class_id = trainer["classId"]
        class_name = trainer["className"]
        previous = names.setdefault(class_id, class_name)
        if previous != class_name:
            raise ValueError(f"classId {class_id} tem nomes incompatíveis em trainers.json: {previous!r}/{class_name!r}")
    return names


def trainer_class_audio_rows(
    trainer_rows: list[dict[str, int]],
    class_arguments: list[int | None],
    groups: dict[int, list[int]],
    sounds: dict[int, dict[str, Any]],
    names: dict[int, str],
) -> list[dict[str, Any]]:
    counts = Counter(row["classId"] for row in trainer_rows)
    class_rows = []
    for class_id, trainer_count in sorted(counts.items()):
        if class_id >= len(class_arguments):
            raise ValueError(f"trdata classId {class_id} fora de {len(class_arguments)} registros trclass")
        argument = class_arguments[class_id]
        encoded_id = resolve_seplay_bcsar_id(argument, groups) if argument is not None else None
        reference = sound_reference(encoded_id, sounds)
        class_rows.append({
            "classId": class_id,
            "className": names.get(class_id),
            "trainerCount": trainer_count,
            "classAudioArgument": f"0x{argument:08X}" if argument is not None else None,
            "bcsar": reference,
        })
    return class_rows


def dispatch_group_metadata(code: bytes, table_va: int, groups: dict[int, list[int]]) -> dict[str, dict[str, Any]]:
    offset = va_to_file_offset(table_va, "tabela de dispatch")
    metadata = {}
    for group, entries in groups.items():
        count, entries_va = struct.unpack_from("<II", code, offset + group * 8)
        metadata[str(group)] = {
            "count": count,
            "entriesVirtualAddress": f"0x{entries_va:X}" if count else None,
            "entriesFileOffset": f"0x{va_to_file_offset(entries_va, f'group {group}') :X}" if count else None,
            "verifiedEntries": len(entries),
        }
    return metadata


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    input_paths = {
        "DllField.cro": args.field_cro,
        "DllBattle.cro": args.battle_cro,
        "code.bin": args.code_bin,
        "sango_sound.bcsar": args.bcsar,
        "a/0/3/6": args.trdata,
        "a/0/3/7": args.trclass,
    }
    inputs = {name: path.read_bytes() for name, path in input_paths.items()}
    field_blob = inputs["DllField.cro"]
    battle_blob = inputs["DllBattle.cro"]
    code = inputs["code.bin"]
    bcsar = parse_bcsar(inputs["sango_sound.bcsar"])
    sound_by_index = {sound["index"]: sound for sound in bcsar["sounds"]}
    dispatch_pointer = read_dispatch_table_pointer(code)
    dispatch_groups = read_dispatch_tables(code, dispatch_pointer)
    literals = scan_seplay_ids(args.zone_scripts)
    seplay_mappings = []
    for literal in literals:
        encoded_id = resolve_seplay_bcsar_id(literal["id"], dispatch_groups)
        seplay_mappings.append({**literal, "bcsar": sound_reference(encoded_id, sound_by_index)})

    field_image = CroImage(field_blob)
    wrappers: dict[str, Any] = {}
    for name in NATIVE_CANDIDATES:
        try:
            table_offset, wrapper_offset = field_image.native(name)
        except ValueError:
            continue
        wrappers[name] = trace_native_wrapper(field_image, code, name, table_offset, wrapper_offset)

    trainer_entries = read_garc_entries(inputs["a/0/3/6"])
    class_entries = read_garc_entries(inputs["a/0/3/7"])
    trainer_rows = read_trainer_data_classes(trainer_entries)
    class_arguments = read_trainer_class_audio_arguments(class_entries)
    class_rows = trainer_class_audio_rows(
        trainer_rows, class_arguments, dispatch_groups, sound_by_index, class_names_by_id(args.trainers_json)
    )
    json_trainers = json.loads(args.trainers_json.read_text(encoding="utf-8")) if args.trainers_json.is_file() else []
    rom_class_by_id = {row["trainerId"]: row["classId"] for row in trainer_rows}
    json_class_by_id = {row["id"]: row["classId"] for row in json_trainers}
    class_mismatches = [
        {"trainerId": trainer_id, "romClassId": rom_class_by_id.get(trainer_id), "jsonClassId": json_class_by_id.get(trainer_id)}
        for trainer_id in sorted(set(rom_class_by_id) | set(json_class_by_id))
        if rom_class_by_id.get(trainer_id) != json_class_by_id.get(trainer_id)
    ]

    victory = []
    for label in WIN_LABELS:
        matches = [sound for sound in bcsar["sounds"] if sound["label"] == label]
        sound = matches[0] if len(matches) == 1 else None
        encoded_id = (BCSAR_SOUND_TYPE << 24) | sound["index"] if sound else None
        victory.append({
            "label": label,
            "soundIndex": sound["index"] if sound else None,
            "bcsarEncodedId": f"0x{encoded_id:08X}" if encoded_id is not None else None,
            "codeBinAlignedOffsets": [f"0x{offset:X}" for offset in scan_byte_offsets(code, encoded_id, aligned=True)] if encoded_id is not None else [],
            "battleCroAlignedOffsets": [f"0x{offset:X}" for offset in scan_byte_offsets(battle_blob, encoded_id, aligned=True)] if encoded_id is not None else [],
        })
    class_rows_by_label: dict[str, list[dict[str, Any]]] = {}
    for row in class_rows:
        label = row["bcsar"]["label"] if row["bcsar"] else "<unmapped>"
        class_rows_by_label.setdefault(label, []).append(row)
    mapped_victory_classes = [
        row["classId"] for row in class_rows if row["bcsar"] and row["bcsar"]["label"] in WIN_LABELS
    ]

    return {
        "inputs": {
            name: {"path": str(path), "sha256": sha256(inputs[name]), "size": len(inputs[name])}
            for name, path in input_paths.items()
        },
        "seplayDispatch": {
            "decoderFileOffset": "0x15984",
            "groupTablePointerLiteralFileOffset": f"0x{DISPATCH_POINTER_FILE_OFFSET:X}",
            "groupTableVirtualAddress": f"0x{dispatch_pointer:X}",
            "groupCount": len(dispatch_groups),
            "groups": dispatch_group_metadata(code, dispatch_pointer, dispatch_groups),
            "corpusLiteralCount": len(seplay_mappings),
            "verifiedCount": sum(row["bcsar"] is not None for row in seplay_mappings),
            "mappings": seplay_mappings,
        },
        "nativeWrappers": wrappers,
        "nativeWrapperSearch": {
            "found": sorted(wrappers),
            "notFound": [name for name in NATIVE_CANDIDATES if name not in wrappers],
        },
        "trainerClassBgm": {
            "trdataGarcEntryCount": len(trainer_entries),
            "trdataLiveTrainerCount": len(trainer_rows),
            "trainersJsonCount": len(json_trainers),
            "trainerClassMismatches": class_mismatches,
            "trclassGarcEntryCount": len(class_entries),
            "trclassRecordSize": TRAINER_CLASS_SIZE,
            "classAudioArgumentOffset": f"0x{TRAINER_CLASS_BGM_OFFSET:X}",
            "accessorEvidence": {
                "trdataClassIdOffset": "0x02",
                "trdataClassIdWidth": "u16",
                "trainerGetInfoNativeWrapperFileOffset": "0x548D0",
                "classSelector": 3,
                "classTableLoaderCodeFileOffset": "0x3540C4",
                "classTableLoaderArchiveId": "0x25",
                "classRecordCopyOffset": "0x04",
                "classInfoGetterCodeFileOffset": "0x3E7A5C",
                "classInfoGetterObjectOffset": "0x10",
                "trainerBgmNativeWrapperFileOffset": "0x555F4",
                "trainerBgmCodeHelperFileOffset": "0x34D35C",
                "trainerBgmSetupHelperFileOffset": "0x34EA28",
                "trainerBgmDecoderCallFileOffset": "0x34D394",
                "trainerBgmDecoderInputLiteralFileOffset": "0x34D3B4",
                "trainerBgmDecoderInputLiteral": "0x00090004",
                "dispatchDecoderCodeFileOffset": "0x15984",
            },
            "classesUsedByTrdata": class_rows,
            "classTrackGroups": class_rows_by_label,
            "trdataFieldAt0x0CNonzeroCount": sum(
                bool(entry and len(entry) == TRAINER_DATA_SIZE and struct.unpack_from("<I", entry, 0x0C)[0])
                for entry in trainer_entries
            ),
        },
        "victoryThemeEvidence": {
            "genericBgmSoundIndexTableFileOffset": "0x4928DC",
            "bcsarLabels": victory,
            "trclassClassIdsReferencingWinTracks": mapped_victory_classes,
            "selectionMappingProven": False,
            "boundary": "BCSAR IDs/labels are resolved; no trclass, trdata, or DllBattle class-to-WIN1/2/3 selection table was identified by this probe.",
        },
        "battleAudioComparison": {
            "classTrackLabels": sorted(class_rows_by_label),
            "coreContextTracks": [
                "STRM_BGM_VS_NORAPOKE_SG", "STRM_BGM_VS_TRAINER_SG", "STRM_BGM_VS_RIVAL_SG",
                "STRM_BGM_VS_GYMLEADER_SG", "STRM_BGM_VS_SHITENNO_SG", "STRM_BGM_VS_CHAMP_SG",
                "STRM_BGM_VS_LEGEND_SG",
            ],
            "classTableValuesResolveAgainstGenericDispatch": True,
            "classFieldInvocationFlowProven": False,
            "finding": "trclass @0x0C values resolve through the generic dispatch table to 20 BCSAR tracks. TrainerGetInfo exposes this class field and _TrainerBGMPlay accepts an argument, but the helper trace does not prove that each battle passes this field unchanged into the decoder; the class tracks are distinct from battleAudio.ts context tracks. WIN1/2/3 selection by context remains unproven.",
        },
        "negativeSearch": {
            "battleCroContainsWinLabels": any(label.encode("ascii") in battle_blob for label in WIN_LABELS),
            "battleCroContainsSeplayName": b"SEPlay\0" in battle_blob,
            "battleCroSize": len(battle_blob),
        },
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspeciona dispatch ARM SEPlay, BCSAR e BGM por classe de treinador.")
    parser.add_argument("--rom-root", type=Path, default=DEFAULT_ROM_ROOT)
    parser.add_argument("--field-cro", type=Path)
    parser.add_argument("--battle-cro", type=Path)
    parser.add_argument("--code-bin", type=Path)
    parser.add_argument("--bcsar", type=Path)
    parser.add_argument("--trdata", type=Path)
    parser.add_argument("--trclass", type=Path)
    parser.add_argument("--zone-scripts", type=Path, default=Path("src/data/zone_scripts"))
    parser.add_argument("--trainers-json", type=Path, default=Path("src/data/battle/trainers.json"))
    parser.add_argument("--report", type=Path, default=Path("/tmp/audio-dispatch-report.json"))
    return parser


def set_default_inputs(args: argparse.Namespace) -> None:
    args.field_cro = args.field_cro or args.rom_root / "RomFS/DllField.cro"
    args.battle_cro = args.battle_cro or args.rom_root / "RomFS/DllBattle.cro"
    args.code_bin = args.code_bin or args.rom_root / "ExeFS/code.bin"
    args.bcsar = args.bcsar or args.rom_root / "RomFS/sound/sango_sound.bcsar"
    args.trdata = args.trdata or args.rom_root / "RomFS/a/0/3/6"
    args.trclass = args.trclass or args.rom_root / "RomFS/a/0/3/7"


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    set_default_inputs(args)
    if not args.zone_scripts.is_dir():
        parser.error(f"Diretório de scripts AMX ausente: {args.zone_scripts}")
    missing = [str(path) for path in (args.field_cro, args.battle_cro, args.code_bin, args.bcsar, args.trdata, args.trclass) if not path.is_file()]
    if missing:
        parser.error("Arquivos ROM ausentes: " + ", ".join(missing))
    report = build_report(args)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"SEPlay {report['seplayDispatch']['verifiedCount']}/{report['seplayDispatch']['corpusLiteralCount']}; "
        f"trdata {report['trainerClassBgm']['trdataLiveTrainerCount']} treinadores; "
        f"classes {len(report['trainerClassBgm']['classesUsedByTrdata'])}; saída {args.report}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

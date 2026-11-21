#!/usr/bin/env python3
"""Probe AreaNav CRO code and nested ROM resources without writing ROM data into Git."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import struct
from dataclasses import asdict
from pathlib import Path
from typing import Iterable

try:
    from .cro_native_abi import CroImage as RelocatedCroImage
    from .townmap_probe_formats import (
        ResourceHit, iter_garc_entries, parse_darc, scan_payload, write_png,
    )
except ImportError:
    from cro_native_abi import CroImage as RelocatedCroImage
    from townmap_probe_formats import (
        ResourceHit, iter_garc_entries, parse_darc, scan_payload, write_png,
    )


TOWNMAP_CLASSES = (
    'MainSystem', 'NaviLayout', 'MapView', 'MapViewListener', 'TownmapUIListener',
    'TB_CursorView', 'TB_CursorListener', 'MapPosChangeListener',
)
CODE_BASE = 0x100000
UI_RESOURCE_NAME = re.compile(
    r'(?:townmap|pokenavi|poke_navi|poke_point|cursol|hero(?:ine)?_obj|map|navi|icon|button|btn)', re.I
)
COORDINATE_CODE_CANDIDATES = (
    ('MapView vtable slot 0', 0x9BDC, 0x100),
    ('MapView vtable slot 6', 0x9AC4, 0x100),
    ('MapView helper', 0x9F54, 0x100),
)


class CroImage(RelocatedCroImage):
    """CRO relocations plus the module's name, public exports, and RTTI vtables."""

    def __init__(self, blob: bytes):
        super().__init__(blob)
        name_offset, name_size = struct.unpack_from('<II', blob, 0xC0)
        self.module_name = self._read_string(name_offset, name_size)
        self.named_exports = self._named_exports()

    def _read_string(self, offset: int, size: int | None = None) -> str:
        end = min(len(self.blob), offset + size) if size else len(self.blob)
        stop = self.blob.find(b'\0', offset, end)
        return self.blob[offset:stop if stop >= 0 else end].decode('ascii', 'replace')

    def _named_exports(self) -> list[tuple[str, int]]:
        offset, count = struct.unpack_from('<II', self.blob, 0xD0)
        exports = []
        for index in range(count):
            name, address = struct.unpack_from('<II', self.blob, offset + index * 8)
            exports.append((self._read_string(name), address))
        return exports

    def imports(self) -> list[dict[str, object]]:
        offset, count = struct.unpack_from('<II', self.blob, 0xF0)
        result = []
        for index in range(count):
            name, _, _, table, entries = struct.unpack_from('<IIIII', self.blob, offset + index * 20)
            symbols = [struct.unpack_from('<II', self.blob, table + row * 8) for row in range(entries)]
            result.append({'module': self._read_string(name), 'count': entries, 'symbols': symbols})
        return result

    def strings(self) -> list[tuple[int, str]]:
        return [(match.start(), match.group().decode('ascii'))
                for match in re.finditer(rb'[\x20-\x7e]{4,}(?=\0)', self.blob)]

    def referenced_archive_paths(self) -> list[tuple[int, str]]:
        pattern = re.compile(rb'(?:RomFS/)?a/\d+/\d+/\d+')
        return [(match.start(), match.group().decode('ascii')) for match in pattern.finditer(self.blob)]

    def class_vtables(self, names: Iterable[str]) -> list[dict[str, object]]:
        wanted = set(names)
        strings = {text: offset for offset, text in self.strings() if text.startswith('N3app7townmap')}
        rows = []
        code_start, code_length, _ = self.segments[0]
        code_end = code_start + code_length
        for mangled, name_offset in strings.items():
            short = mangled.split('townmap', 1)[-1]
            short = re.sub(r'^\d+', '', short).split('E', 1)[0]
            if short not in wanted:
                continue
            name_patches = [patch for patch, target in self.references.items() if target == name_offset]
            for name_patch in name_patches:
                type_info = name_patch - 4
                vtable_headers = [patch for patch, target in self.references.items() if target == type_info]
                for header in vtable_headers:
                    methods = []
                    patch = header + 4
                    while patch in self.references:
                        target = self.references[patch]
                        if not code_start <= target < code_end:
                            break
                        methods.append(target)
                        patch += 4
                    if methods:
                        rows.append({'class': short, 'vtable': header + 4, 'type_info': type_info,
                                     'methods': methods})
        return rows


def disassemble_arm(blob: bytes, offset: int, size: int = 0x80, address: int | None = None):
    from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
    disassembler = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    start = offset if address is None else address
    return [(item.address, item.mnemonic, item.op_str)
            for item in disassembler.disasm(blob[offset:offset + size], start)]


def _vtable_disassembly(image: CroImage, byte_limit: int = 0x80) -> list[dict[str, object]]:
    rows = []
    for vtable in image.class_vtables(TOWNMAP_CLASSES):
        for slot, target in enumerate(vtable['methods']):
            rows.append({'class': vtable['class'], 'vtable': vtable['vtable'],
                         'slot': slot, 'offset': target,
                         'instructions': disassemble_arm(image.relocated(), target, byte_limit)})
    return rows


def _arm_literal_float_references(blob: bytes, instructions) -> list[dict[str, object]]:
    literals = []
    for address, mnemonic, operands in instructions:
        if not mnemonic.startswith('vldr'):
            continue
        match = re.search(r'\[pc,\s*#(-?(?:0x[\da-f]+|\d+))\]', operands, re.I)
        if not match:
            continue
        data_offset = address + 8 + int(match.group(1), 0)
        if data_offset < 0 or data_offset + 4 > len(blob):
            continue
        value = struct.unpack_from('<f', blob, data_offset)[0]
        if math.isfinite(value):
            literals.append({'instruction': address, 'data_offset': data_offset, 'value': value})
    return literals


def _coordinate_code_evidence(image: CroImage, disassemble: bool) -> list[dict[str, object]]:
    if not disassemble:
        return [{'candidate': name, 'file_offset': offset} for name, offset, _ in COORDINATE_CODE_CANDIDATES]
    relocated = image.relocated()
    rows = []
    for name, offset, byte_count in COORDINATE_CODE_CANDIDATES:
        instructions = disassemble_arm(relocated, offset, byte_count)
        rows.append({
            'candidate': name,
            'file_offset': offset,
            'direct_calls': [
                {'instruction': address, 'target': operands}
                for address, mnemonic, operands in instructions
                if mnemonic in ('bl', 'blx') and operands.startswith('#')
            ],
            'literal_floats': _arm_literal_float_references(relocated, instructions),
            'instructions': instructions,
        })
    return rows


def _clyt_texture_names(blob: bytes) -> list[str]:
    if len(blob) < 20 or blob[:4] != b'CLYT':
        raise ValueError('Expected a CLYT layout with a 20-byte header')
    bom, header_size = struct.unpack_from('<HH', blob, 4)
    file_size, section_count = struct.unpack_from('<II', blob, 12)
    if bom != 0xFEFF or header_size != 20 or not 20 <= file_size <= len(blob):
        raise ValueError(f'Invalid CLYT header: bom={bom:#x}, header={header_size}, size={file_size}')
    cursor = header_size
    for _ in range(section_count):
        if cursor + 8 > file_size:
            raise ValueError(f'Truncated CLYT section at offset {cursor:#x}')
        kind = blob[cursor:cursor + 4]
        section_size = struct.unpack_from('<I', blob, cursor + 4)[0]
        end = cursor + section_size
        if section_size < 8 or end > file_size:
            raise ValueError(f'CLYT section {kind!r} exceeds file size at offset {cursor:#x}')
        if kind == b'txl1':
            return _txl1_names(blob, cursor, section_size)
        cursor = end
    return []


def _txl1_names(blob: bytes, cursor: int, section_size: int) -> list[str]:
    if section_size < 12:
        raise ValueError('CLYT txl1 section is shorter than its count field')
    count = struct.unpack_from('<I', blob, cursor + 8)[0]
    table_start = cursor + 12
    table_end = table_start + count * 4
    section_end = cursor + section_size
    if table_end > section_end:
        raise ValueError(f'CLYT txl1 has {count} offsets outside its section')
    names = []
    for index in range(count):
        relative = struct.unpack_from('<I', blob, table_start + index * 4)[0]
        start = table_start + relative
        if start >= section_end:
            raise ValueError(f'CLYT txl1 name {index} starts outside its section')
        end = blob.find(b'\0', start, section_end)
        if end < 0:
            raise ValueError(f'CLYT txl1 name {index} is not NUL-terminated')
        names.append(blob[start:end].decode('ascii', 'replace'))
    return names


def _layout_texture_dependencies(a_dir: Path, hit: ResourceHit) -> list[str]:
    archive_path = a_dir.joinpath(*hit.archive.split('/')[1:])
    archive_blob = archive_path.read_bytes()
    entry = next((row for row in iter_garc_entries(archive_blob)
                  if row.slot == hit.slot and row.subslot == hit.subslot), None)
    if entry is None:
        raise ValueError(f'{hit.archive} has no GARC payload at slot {hit.slot}/{hit.subslot}')
    layout = _find_named_texture(entry.data, hit.container)
    if layout is None:
        raise ValueError(f'{hit.archive} cannot resolve named layout {hit.container}')
    return _clyt_texture_names(layout)


def _ui_resource_candidates(hits: Iterable[ResourceHit]) -> list[dict[str, object]]:
    candidates = []
    for hit in hits:
        if hit.kind not in ('CLIM', 'FLIM', 'CLYT') or not UI_RESOURCE_NAME.search(hit.container):
            continue
        candidates.append(asdict(hit))
    return candidates


def _codebin_targets(binary: bytes, virtual_addresses: Iterable[int]):
    from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM, CS_MODE_THUMB
    targets = set(virtual_addresses)
    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    callers = {target: [] for target in targets}
    for insn in md.disasm(binary, CODE_BASE):
        if insn.mnemonic not in ('bl', 'blx') or not insn.op_str.startswith('#'):
            continue
        try:
            target = int(insn.op_str[1:], 0)
        except ValueError:
            continue
        if target in callers:
            callers[target].append({'address': insn.address, 'mode': 'ARM'})
    thumb = Cs(CS_ARCH_ARM, CS_MODE_THUMB)
    for offset in range(0, len(binary) - 3, 2):
        for insn in thumb.disasm(binary[offset:offset + 4], CODE_BASE + offset, count=1):
            if insn.mnemonic not in ('bl', 'blx') or not insn.op_str.startswith('#'):
                continue
            try:
                target = int(insn.op_str[1:], 0)
            except ValueError:
                continue
            if target in callers:
                callers[target].append({'address': insn.address, 'mode': 'Thumb'})
    return callers


def _codebin_routines(binary: bytes, virtual_addresses: Iterable[int]) -> list[dict[str, object]]:
    rows = []
    for address in virtual_addresses:
        offset = address - CODE_BASE
        instructions = disassemble_arm(binary, offset, 0x100, address)
        calls = [{'address': pc, 'mnemonic': mnemonic, 'target': operands}
                 for pc, mnemonic, operands in instructions
                 if mnemonic in ('bl', 'blx')]
        rows.append({'address': address, 'file_offset': offset,
                     'instructions': instructions, 'calls': calls})
    return rows


def _sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _scan_romfs_a(a_dir: Path, extract_dir: Path | None = None) -> tuple[list[ResourceHit], dict[str, int]]:
    hits = []
    counts: dict[str, int] = {}
    for path in sorted(item for item in a_dir.rglob('*') if item.is_file()):
        blob = path.read_bytes()
        archive = path.relative_to(a_dir.parent).as_posix()
        if blob[:4] != b'CRAG':
            for hit in scan_payload(blob, archive, -1, 0, 'loose'):
                hits.append(hit)
            continue
        counts['garcs'] = counts.get('garcs', 0) + 1
        try:
            for entry in iter_garc_entries(blob):
                counts['garc_slots'] = counts.get('garc_slots', 0) + 1
                if entry.decompression_failed:
                    counts['lz11_decode_failed'] = counts.get('lz11_decode_failed', 0) + 1
                container = 'LZ11 payload' if entry.compressed else 'GARC payload'
                found = scan_payload(entry.data, archive, entry.slot, entry.subslot, container)
                hits.extend(found)
                for hit in found:
                    counts[hit.kind] = counts.get(hit.kind, 0) + 1
                if extract_dir:
                    _extract_named_samples(entry.data, found, archive, entry.slot, extract_dir, container)
        except ValueError as error:
            counts['invalid_garc'] = counts.get('invalid_garc', 0) + 1
            print(f'warning: {archive}: {error}')
    return hits, counts


def _scan_loose_assets(romfs: Path, directories: tuple[str, ...]) -> dict[str, object]:
    files = []
    hits = []
    for directory in directories:
        root = romfs / directory
        if not root.is_dir():
            continue
        for path in sorted(item for item in root.rglob('*') if item.is_file()):
            blob = path.read_bytes()
            found = scan_payload(blob, path.relative_to(romfs).as_posix(), -1, 0, 'loose')
            files.append({'path': path.relative_to(romfs).as_posix(), 'size': len(blob),
                          'sha256': _sha(path), 'hits': [asdict(hit) for hit in found]})
            hits.extend(found)
    return {'directories': {name: (romfs / name).is_dir() for name in directories},
            'files': files, 'hits': [asdict(hit) for hit in hits]}


def _extract_named_samples(entry_data, found, archive, slot, extract_dir, container):
    sample_name = re.compile(r'poke_navi_map|map_(?:lower|navi|city)|map\.bclim|townmap|finger_icon|hoenn', re.I)
    for child in found:
        if child.kind not in ('CLIM', 'FLIM'):
            continue
        if not sample_name.search(child.container):
            continue
        source = entry_data if child.container == container else _find_named_texture(entry_data, child.container)
        if source is None:
            continue
        safe = re.sub(r'[^A-Za-z0-9_.-]+', '_', child.container)[-100:]
        write_png(source, extract_dir / f'{archive.replace('/', '_')}_s{slot:04}_ss{child.subslot:02}_{safe}.png')


def _find_named_texture(blob: bytes, label: str) -> bytes | None:
    match = re.search(r'darc@([0-9a-fx]+)\s*/\s*(.+)$', label)
    if not match:
        return None
    darc_offset = int(match.group(1), 16)
    name = match.group(2)
    try:
        entries = parse_darc(blob, darc_offset)
    except ValueError:
        return None
    return next((entry.data for entry in entries if entry.name in name), None)


def inspect(args: argparse.Namespace) -> dict[str, object]:
    root = args.extracted
    romfs = root / 'RomFS' if (root / 'RomFS').is_dir() else root
    exefs = root / 'ExeFS'
    townmap_path = romfs / 'DllTownmap.cro'
    field_path = romfs / 'DllField.cro'
    code_path = exefs / 'code.bin'
    for path in (townmap_path, field_path, code_path):
        if not path.is_file():
            raise FileNotFoundError(f'Required ROM input is missing: {path}')
    townmap_blob = townmap_path.read_bytes()
    field_blob = field_path.read_bytes()
    code_blob = code_path.read_bytes()
    townmap = CroImage(townmap_blob)
    field = RelocatedCroImage(field_blob)
    imports = townmap.imports()
    vtables = _vtable_disassembly(townmap) if args.disassemble else []
    field_disassembly = disassemble_arm(field.relocated(), 0x2EE38, 0x400) if args.disassemble else []
    code_targets = (0x4DDF14, 0x4DDE08)
    callers = _codebin_targets(code_blob, code_targets) if args.disassemble else {}
    code_routines = _codebin_routines(code_blob, code_targets) if args.disassemble else []
    hits, scan_counts = _scan_romfs_a(romfs / 'a', args.extract_to)
    map_lower_hit = next((hit for hit in hits
                          if hit.archive == 'a/0/6/7' and hit.kind == 'CLYT'
                          and hit.container.endswith('/map_lower.bclyt')), None)
    map_lower_textures = (_layout_texture_dependencies(romfs / 'a', map_lower_hit)
                          if map_lower_hit else [])
    loose_scan = _scan_loose_assets(romfs, ('shader', 'g3d_common'))
    summary = {
        'inputs': {str(path): {'size': path.stat().st_size, 'sha256': _sha(path)}
                   for path in (townmap_path, field_path, code_path)},
        'townmap': {
            'module': townmap.module_name, 'exports': townmap.named_exports,
            'imports': imports,
            'strings': townmap.strings(), 'archive_paths': townmap.referenced_archive_paths(),
            'tables': {'segments': townmap.segments, 'named_exports': 0xD0,
                       'import_modules': 0xF0, 'external_relocations': 0xF8,
                       'internal_relocations': 0x128},
            'vtables': vtables,
            'coordinate_candidates': _coordinate_code_evidence(townmap, args.disassemble),
            'map_lower_texture_names': map_lower_textures,
        },
        'pseudo_lighting': {
            'callback': 0x2EE38, 'vtable': 0x1077E8,
            'vtable_targets': {hex(patch): hex(target) for patch, target in field.references.items()
                               if 0x1077E8 <= patch < 0x1077FC},
            'disassembly': field_disassembly,
        },
        'codebin': {'addresses': [0x4DDF14, 0x4DDE08],
                    'file_offsets': [0x3DDF14, 0x3DDE08], 'direct_callers': callers,
                    'routines': code_routines},
        'resource_scan': {'counts': scan_counts, 'hits': [asdict(hit) for hit in hits],
                          'ui_asset_candidates': _ui_resource_candidates(hits)},
        'loose_scan': loose_scan,
    }
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description='Inspect DllTownmap CRO and nested AreaNav/PICA resources.')
    parser.add_argument('--extracted', type=Path, required=True,
                        help='ROM extraction root containing RomFS/ and ExeFS/')
    parser.add_argument('--disassemble', action='store_true', help='Disassemble Townmap vtables and light callback')
    parser.add_argument('--extract-to', type=Path,
                        help='Write name-matched AreaNav/map/icon BCLIM samples as PNGs under this directory')
    parser.add_argument('--json', type=Path, help='Write the full report JSON to this path')
    args = parser.parse_args()
    report = inspect(args)
    encoded = json.dumps(report, indent=2, ensure_ascii=False)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(encoded + '\n', encoding='utf-8')
    townmap_input = next(value for name, value in report['inputs'].items()
                         if name.endswith('/DllTownmap.cro'))
    print(f"DllTownmap {report['townmap']['module']} SHA256 {townmap_input['sha256']}")
    print(f"ROM assets scanned: {report['resource_scan']['counts']}")
    print(f"Loose assets scanned: {len(report['loose_scan']['files'])} files; "
          f"{len(report['loose_scan']['hits'])} recognized resource hits")
    if args.disassemble:
        print(f"Townmap vtable methods disassembled: {len(report['townmap']['vtables'])}")
        print(f"Direct code.bin callers: {report['codebin']['direct_callers']}")
    if args.extract_to:
        print(f'PNG samples, if a named map/icon texture was found: {args.extract_to}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

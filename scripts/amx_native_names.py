"""Resolve hashes GF por nomes presentes na ROM ou candidatos comunitários citados."""

import hashlib
import re
from collections.abc import Iterable


COMMUNITY_NAMES = ('GetRank', 'SEPlay', 'SetTrainer', 'ControlMotionBlur',
                   'ControlMotionBlurColor', 'FlagGet', 'InitMotionBlur',
                   'ReserveScript', '_Suspend', 'MdlAcmdSet', 'WorkSet', 'FlagSet')


def hash_name(name: str) -> int:
    value = 0
    for byte in name.encode('ascii'):
        value = ((value * 131) ^ byte) & 0xFFFFFFFF
    return value


def resolve_native_names(identifiers: set[int], sources: Iterable[tuple[str, bytes]]) -> dict:
    resolved = {}
    for source, raw in sources:
        source_hash = hashlib.sha256(raw).hexdigest()
        for match in re.finditer(rb'(?=([A-Za-z_][A-Za-z0-9_]{2,100})\x00)', raw):
            name = match.group(1).decode('ascii')
            identifier = hash_name(name)
            if identifier not in identifiers:
                continue
            if identifier in resolved and resolved[identifier]['name'] != name:
                raise ValueError(f'Colisão de hash GF {identifier:08x}: {name}')
            resolved.setdefault(identifier, {'name': name, 'evidence': 'rom-string-hash',
                                             'source': source, 'sourceSha256': source_hash,
                                             'offset': match.start()})
    for name in COMMUNITY_NAMES:
        identifier = hash_name(name)
        if identifier in identifiers:
            resolved.setdefault(identifier, {'name': name, 'evidence': 'community-hash',
                                             'source': 'XAMX/commands.txt'})
    return resolved

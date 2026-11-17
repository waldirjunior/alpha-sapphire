"""Referências de eventos e navegação obtidas diretamente do sec1 do ZO."""

import struct


def parse_zone_entities(raw: bytes) -> dict:
    start, end = struct.unpack_from('<II', raw, 8)
    section = raw[start:end]
    _, furniture, npcs, warps, triggers, triggers2 = struct.unpack_from('<IBBBBI', section)
    position = 12
    entities = {}
    for group, count, size, script_offset in (
        ('furniture', furniture, 20, 0), ('npcs', npcs, 48, 10),
        ('warps', warps, 24, None), ('triggers', triggers, 24, 0), ('triggers2', triggers2, 24, 0),
    ):
        records = [section[position + i * size:position + (i + 1) * size] for i in range(count)]
        entities[group] = [parse_entity(record, group, script_offset) for record in records]
        position += count * size
    return entities


def parse_entity(record: bytes, group: str, script_offset: int | None) -> dict:
    if group == 'warps':
        destination, tile = struct.unpack_from('<HH', record)
        return {'destinationMap': destination, 'destinationTile': tile,
                'faceDirection': record[4], 'transitionEffect': record[5]}
    result = {'script': struct.unpack_from('<H', record, script_offset)[0]}
    if group == 'npcs':
        result['id'] = struct.unpack_from('<H', record)[0]
    return result


def warp_bindings(entities: dict) -> list[dict]:
    return [{'index': index, 'scriptId': None, 'status': 'navigation-no-script-field', **warp}
            for index, warp in enumerate(entities['warps'])]

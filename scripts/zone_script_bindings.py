"""Associa IDs de entidades aos cases do seletor exportado no main AMX."""

import struct


def validate_entity_record(section: bytes, position: int, group: str, index: int,
                           entry: dict, script_offset: int | None) -> None:
    if script_offset is not None:
        script = struct.unpack_from('<H', section, position + script_offset)[0]
        if entry['script'] != script:
            raise ValueError(f'ZO/JSON: {group}[{index}].script diverge ({script} vs {entry["script"]})')
    if group == 'npcs' and entry['id'] != struct.unpack_from('<H', section, position)[0]:
        raise ValueError(f'ZO/JSON: {group}[{index}].id diverge')


def validate_entity_scripts(raw: bytes, zone: dict) -> None:
    start, end = struct.unpack_from('<II', raw, 8)
    section = raw[start:end]
    _, furniture, npcs, warps, triggers1, triggers2 = struct.unpack_from('<IBBBBI', section)
    position = 12
    for group, count, size, script_offset in (
        ('furniture', furniture, 20, 0), ('npcs', npcs, 48, 10),
        ('warps', warps, 24, None), ('triggers', triggers1, 24, 0), ('triggers2', triggers2, 24, 0),
    ):
        entries = zone.get(group, [])
        if len(entries) != count:
            raise ValueError(f'ZO/JSON: contagem de {group} diverge ({count} vs {len(entries)})')
        for index, entry in enumerate(entries):
            validate_entity_record(section, position + index * size, group, index, entry, script_offset)
        position += count * size


def wrapper_calls(by_offset: dict, target: int) -> list[int]:
    push = by_offset[target]
    if push['opcode'] not in (39, 188) or push['operands'] != [0]:
        return []
    call = by_offset.get(target + push['size'])
    if not call or call['opcode'] != 49:
        return []
    jump = by_offset.get(call['offset'] + call['size'])
    return [call['target']] if jump and jump['opcode'] == 51 else []


def find_dispatch(program: dict) -> dict | None:
    instructions = program['instructions']
    by_offset = {row['offset']: row for row in instructions}
    main = program['header']['cip']
    entry = by_offset.get(main)
    if not entry or entry['opcode'] != 46:
        return None
    load = by_offset.get(main + entry['size'])
    if not load or load['opcode'] not in (1, 162):
        return None
    switch = by_offset.get(load['offset'] + load['size'])
    variables = program['tables']['pubvars']
    if not switch or switch['opcode'] != 129:
        return None
    selector = next((var for var in variables if var['address'] == load['operands'][0]), None)
    if selector is None:
        return None
    table = by_offset[switch['target']]
    return {'main': main, 'selectorAddress': selector['address'],
            'selectorHash': f'{selector["identifier"]:08x}', 'switchOffset': switch['offset'],
            'tableOffset': table['offset'], 'defaultTarget': table['defaultTarget'],
            'cases': table['cases'],
            'caseCalls': {str(case['value']): wrapper_calls(by_offset, case['target']) for case in table['cases']},
            'evidence': 'main-exported-selector-switch'}


def bind_entities(zone: dict, dispatches: dict[str, dict | None]) -> list[dict]:
    bindings = []
    for group in ('furniture', 'npcs', 'triggers', 'triggers2'):
        for index, entity in enumerate(zone.get(group, [])):
            script = entity['script']
            matches = [{'program': name, 'target': case['target'],
                        'functions': dispatch['caseCalls'].get(str(script), []),
                        'tableOffset': dispatch['tableOffset']}
                       for name, dispatch in dispatches.items() if dispatch is not None
                       for case in dispatch['cases'] if case['value'] == script]
            status = 'matched-dispatch' if len(matches) == 1 else 'ambiguous' if matches else 'unresolved'
            bindings.append({'kind': group, 'index': index, 'entityId': entity.get('id'),
                             'scriptId': script, 'status': status, 'matches': matches})
    return bindings

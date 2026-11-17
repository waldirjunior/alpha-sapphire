"""Disassembly estrutural Pawn v10; falha fechada para opcodes não suportados."""

from .amx_opcodes import NAMES, OPERAND_COUNTS, RELATIVE_BRANCHES, UNSUPPORTED, signed


def instruction_cell_count(cells: list[int], index: int, opcode: int) -> int:
    count = OPERAND_COUNTS.get(opcode, 0)
    if opcode == 130:
        if index + 1 >= len(cells):
            raise ValueError(f'AMX casetbl truncada em {index * 4:04x}')
        count = 2 + 2 * cells[index + 1]
    if index + count >= len(cells):
        raise ValueError(f'AMX instrução truncada em {index * 4:04x}')
    return count + 1


def control_flow_fields(opcode: int, offset: int, operands: list[int]) -> dict:
    if opcode in RELATIVE_BRANCHES:
        return {'target': offset + operands[0]}
    if opcode != 130:
        return {}
    return {'defaultTarget': offset + 4 + operands[1],
            'cases': [{'value': operands[2 + i * 2], 'target': offset + 12 + i * 8 + operands[3 + i * 2]}
                      for i in range(operands[0])]}


def decode_instruction(cells: list[int], index: int) -> dict:
    word = cells[index]
    opcode = word & 0xFFFF
    if opcode >= len(NAMES) or opcode in UNSUPPORTED:
        raise ValueError(f'AMX opcode {opcode:04x} não suportado em {index * 4:04x}')
    count = instruction_cell_count(cells, index, opcode)
    packed = 162 <= opcode <= 212
    if not packed and word >> 16:
        raise ValueError(f'AMX opcode não packed com bits altos em {index * 4:04x}')
    operands = [signed(word >> 16, 16)] if packed else [signed(v) for v in cells[index + 1:index + count]]
    return {'offset': index * 4, 'opcode': opcode, 'mnemonic': NAMES[opcode],
            'operands': operands, 'size': count * 4, **control_flow_fields(opcode, index * 4, operands)}


def annotate_native(instruction: dict, natives: list[dict], names: dict) -> None:
    if instruction['opcode'] not in (123, 135):
        return
    index = instruction['operands'][0]
    if not 0 <= index < len(natives):
        raise ValueError(f'AMX native index {index} inválido em {instruction["offset"]:04x}')
    identifier = natives[index]['identifier']
    resolved = names.get(identifier, {})
    instruction['native'] = {'index': index, 'hash': f'{identifier:08x}',
                             'name': resolved.get('name'), 'evidence': resolved.get('evidence', 'unresolved')}
    if instruction['opcode'] == 135:
        argument_bytes = instruction['operands'][1]
        if argument_bytes < 0 or argument_bytes % 4:
            raise ValueError(f'AMX native argumentBytes inválido: {argument_bytes}')
        instruction['argumentBytes'] = argument_bytes


def validate_targets(instructions: list[dict]) -> None:
    by_offset = {row['offset']: row for row in instructions}
    for row in instructions:
        targets = [row['target']] if 'target' in row else []
        if 'cases' in row:
            targets += [row['defaultTarget'], *(case['target'] for case in row['cases'])]
        for target in targets:
            if target not in by_offset:
                raise ValueError(f'AMX target {target:04x} não é início de instrução (origem {row["offset"]:04x})')
        if row['opcode'] == 129 and by_offset[row['target']]['opcode'] != 130:
            raise ValueError(f'AMX switch target {row["target"]:04x} não é casetbl')


def disassemble(cells: list[int], natives: list[dict] | None = None,
                names: dict | None = None) -> list[dict]:
    instructions = []
    index = 0
    while index < len(cells):
        instruction = decode_instruction(cells, index)
        annotate_native(instruction, natives or [], names or {})
        instructions.append(instruction)
        index += instruction['size'] // 4
    validate_targets(instructions)
    return instructions

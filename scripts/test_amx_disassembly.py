import unittest

from scripts.amx_disassembly import disassemble
from scripts.amx_native_names import hash_name, resolve_native_names
from scripts.zone_script_bindings import find_dispatch, bind_entities


class AmxDisassemblyTests(unittest.TestCase):
    def test_packed_signed_and_regular_operand(self):
        result = disassemble([0xFFFC00BF, 39, 123456, 48])
        self.assertEqual([row['mnemonic'] for row in result], ['stack.p', 'push.c', 'retn'])
        self.assertEqual(result[0]['operands'], [-4])
        self.assertEqual(result[1]['size'], 8)
        self.assertEqual(result[2]['offset'], 12)

    def test_relative_branch_is_opcode_relative(self):
        result = disassemble([51, 12, 89, 48])
        self.assertEqual(result[0]['target'], 12)

    def test_branch_into_operand_rejected(self):
        with self.assertRaisesRegex(ValueError, 'target'):
            disassemble([51, 4])

    def test_switch_offsets_are_relative_to_value_cells(self):
        result = disassemble([129, 8, 130, 1, 24, 7, 12, 89, 48, 48])
        self.assertEqual(result[1]['defaultTarget'], 36)
        self.assertEqual(result[1]['cases'], [{'value': 7, 'target': 32}])

    def test_truncated_instruction(self):
        with self.assertRaisesRegex(ValueError, 'truncada'):
            disassemble([135, 0])

    def test_unknown_opcode_does_not_guess_size(self):
        with self.assertRaisesRegex(ValueError, 'opcode'):
            disassemble([0xFFFF])

    def test_resolved_native_and_arity(self):
        natives = [{'identifier': hash_name('FlagSet')}]
        names = {hash_name('FlagSet'): {'name': 'FlagSet', 'evidence': 'synthetic'}}
        result = disassemble([135, 0, 4], natives, names)
        self.assertEqual(result[0]['native']['name'], 'FlagSet')
        self.assertEqual(result[0]['argumentBytes'], 4)

    def test_unknown_native_remains_explicit(self):
        result = disassemble([135, 0, 0], [{'identifier': 123}])
        self.assertIsNone(result[0]['native']['name'])
        self.assertEqual(result[0]['native']['hash'], '0000007b')

    def test_invalid_native_index(self):
        with self.assertRaisesRegex(ValueError, 'native'):
            disassemble([135, 1, 0], [{'identifier': 123}])

    def test_hash_matches_known_command(self):
        self.assertEqual(hash_name('CommandNOP'), 0x590F52EE)

    def test_suffix_pooled_native_string(self):
        result = resolve_native_names({0xc34ad2ab}, [('synthetic.cro', b'BuildMdlSetVisible\0')])
        self.assertEqual(result[0xc34ad2ab]['name'], 'MdlSetVisible')
        self.assertEqual(result[0xc34ad2ab]['offset'], 5)

    def test_rom_strings_resolve_by_hash(self):
        result = resolve_native_names({hash_name('FlagSet'), 123},
                                      [('test.cro', b'\0FlagSet\0OtherName\0')])
        self.assertEqual(result[hash_name('FlagSet')]['name'], 'FlagSet')
        self.assertEqual(result[hash_name('FlagSet')]['offset'], 1)
        self.assertNotIn(123, result)

    def test_dispatch_uses_exported_variable(self):
        code = [46, 162, 129, 8, 130, 1, 24, 7, 12, 89, 48, 48]
        program = {'header': {'cip': 0}, 'tables': {'pubvars': [{'address': 0, 'identifier': 99}]},
                   'instructions': disassemble(code)}
        dispatch = find_dispatch(program)
        self.assertEqual(dispatch['cases'], [{'value': 7, 'target': 40}])
        result = bind_entities({'npcs': [{'id': 5, 'script': 7}, {'id': 6, 'script': 2000}]},
                               {'entities': dispatch, 'map': None})
        self.assertEqual(result[0]['matches'][0]['target'], 40)
        self.assertEqual(result[1]['status'], 'unresolved')

    def test_dispatch_does_not_assume_first_switch(self):
        program = {'header': {'cip': 0}, 'tables': {'pubvars': []},
                   'instructions': disassemble([46, 162, 48])}
        self.assertIsNone(find_dispatch(program))

    def test_dispatch_rejects_nonexported_selector(self):
        code = [46, 162, 129, 8, 130, 0, 8, 48]
        program = {'header': {'cip': 0}, 'tables': {'pubvars': []},
                   'instructions': disassemble(code)}
        self.assertIsNone(find_dispatch(program))


if __name__ == '__main__':
    unittest.main()

import unittest

from scripts.extract_opening_memory import memory_image, native_inventory


class OpeningMemoryTests(unittest.TestCase):
    def test_memory_image_rejects_disassembly_from_another_blob(self):
        program = {'sha256': 'original', 'dataCells': [0, 1], 'header': {'stp': 64, 'dat': 16}}
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            memory_image(program, 'different')
        self.assertEqual(memory_image(program, 'original')['stackTop'], 48)

    def test_native_inventory_keeps_real_offsets_and_arity(self):
        instruction = {'offset': 12, 'native': {'name': 'FlagGet', 'hash': 'synthetic'}, 'argumentBytes': 4}
        result = native_inventory({'instructions': [instruction]})
        self.assertEqual(result, [{'name': 'FlagGet', 'hash': 'synthetic', 'arity': 1, 'offsets': [12]}])

    def test_ambiguous_native_arities_are_not_silently_collapsed(self):
        native = {'name': 'Synthetic', 'hash': 'synthetic'}
        program = {'instructions': [{'offset': 0, 'native': native, 'argumentBytes': 4},
                                    {'offset': 12, 'native': native, 'argumentBytes': 8}]}
        with self.assertRaisesRegex(ValueError, 'aridades'):
            native_inventory(program)


if __name__ == '__main__':
    unittest.main()

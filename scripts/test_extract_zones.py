import struct
import unittest

from scripts.extract_zones import ENCOUNTER_FORMAT, parse_encounters


class EncounterTableTests(unittest.TestCase):
    def test_preserves_the_61_raw_oras_slots_in_order(self):
        slots = [bytes(4) for _ in range(61)]
        slots[0] = struct.pack('<BBH', 3, 4, 1)
        slots[27] = struct.pack('<BBH', 5, 6, (2 << 11) | 129)
        encounters = parse_encounters(bytes(16) + b''.join(slots))

        self.assertEqual(ENCOUNTER_FORMAT, 'oras-61-slot-v1')
        self.assertEqual(len(encounters), 61)
        self.assertEqual(encounters[0], {'species': 1, 'form': 0, 'levelMin': 3, 'levelMax': 4})
        self.assertEqual(encounters[1], {'species': 0, 'form': 0, 'levelMin': 0, 'levelMax': 0})
        self.assertEqual(encounters[27], {'species': 129, 'form': 2, 'levelMin': 5, 'levelMax': 6})

    def test_rejects_a_nonempty_oras_encounter_section_with_unexpected_slot_count(self):
        with self.assertRaisesRegex(ValueError, '61 slots'):
            parse_encounters(bytes(16) + bytes(4))


if __name__ == '__main__':
    unittest.main()

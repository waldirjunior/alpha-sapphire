import struct
import unittest

from scripts.amx_global_scripts import parse_global_scripts
from scripts.test_zone_scripts import synthetic_amx
from scripts.zone_script_bindings import bind_entities, validate_entity_scripts, wrapper_calls
from scripts.zone_script_entities import parse_zone_entities, parse_entity, warp_bindings
from scripts.disassemble_zone_scripts import global_bindings


def synthetic_garc():
    amx = synthetic_amx()
    header = struct.pack('<4sIHHIIII', b'CRAG', 28, 0xFEFF, 0x400, 4, 72, 72 + len(amx), len(amx))
    fato = struct.pack('<4sIHHI', b'OTAF', 16, 1, 0, 0)
    fatb = struct.pack('<4s6I', b'BTAF', 28, 1, 1, 0, len(amx), len(amx))
    return header + fato + fatb + amx


def synthetic_entities():
    npc = bytearray(48)
    struct.pack_into('<H', npc, 0, 3)
    struct.pack_into('<H', npc, 10, 2000)
    trigger1 = struct.pack('<H', 7) + bytes(22)
    trigger2 = struct.pack('<H', 8) + bytes(22)
    entities = struct.pack('<IBBBBI', 104, 0, 1, 0, 1, 1) + npc + trigger1 + trigger2
    header = b'ZO\x05\0' + struct.pack('<6I', 28, 28, 28 + len(entities), 28 + len(entities),
                                         28 + len(entities), 28 + len(entities))
    return header + entities


class ZoneScriptBindingsTests(unittest.TestCase):
    def test_entity_references_come_from_zo_bytes(self):
        entities = parse_zone_entities(synthetic_entities())
        self.assertEqual(entities['npcs'], [{'id': 3, 'script': 2000}])
        self.assertEqual(entities['triggers2'], [{'script': 8}])

    def test_warp_has_destination_not_fabricated_script(self):
        record = struct.pack('<HH', 7, 2) + bytes(20)
        entities = {'warps': [parse_entity(record, 'warps', None)]}
        binding = warp_bindings(entities)[0]
        self.assertIsNone(binding['scriptId'])
        self.assertEqual(binding['destinationMap'], 7)
        self.assertEqual(binding['status'], 'navigation-no-script-field')

    def test_global_reverse_references_preserve_zone_and_ambiguity(self):
        zone = {'zoneId': 6, 'bindings': [{'kind': 'npcs', 'index': 2, 'entityId': 3,
                'scriptId': 2000, 'status': 'ambiguous', 'matches': [
                {'program': 'global:0015', 'target': 32, 'functions': [64]}]}]}
        result = global_bindings('global:0015', [zone])
        self.assertEqual(result[0]['zoneId'], 6)
        self.assertEqual(result[0]['status'], 'ambiguous')
        self.assertEqual(global_bindings('global:0099', [zone]), [])

    def test_global_garc_in_memory(self):
        programs = parse_global_scripts(synthetic_garc())
        self.assertEqual(programs['global:0000']['codeCells'], [46, 112])

    def test_global_garc_rejects_invalid_entry(self):
        raw = bytearray(synthetic_garc())
        struct.pack_into('<I', raw, 60, 100000)
        with self.assertRaisesRegex(ValueError, 'entrada'):
            parse_global_scripts(bytes(raw))

    def test_global_garc_rejects_truncation(self):
        with self.assertRaises(ValueError):
            parse_global_scripts(synthetic_garc()[:64])

    def test_entity_script_fields_match_binary(self):
        zone = {'npcs': [{'id': 3, 'script': 2000}], 'triggers': [{'script': 7}],
                'triggers2': [{'script': 8}]}
        validate_entity_scripts(synthetic_entities(), zone)

    def test_stale_entity_json_rejected(self):
        zone = {'npcs': [{'id': 3, 'script': 2001}], 'triggers': [{'script': 7}],
                'triggers2': [{'script': 8}]}
        with self.assertRaisesRegex(ValueError, 'script diverge'):
            validate_entity_scripts(synthetic_entities(), zone)

    def test_global_binding_keeps_program_identity(self):
        dispatch = {'cases': [{'value': 2000, 'target': 32}], 'tableOffset': 8,
                    'caseCalls': {'2000': [64]}}
        result = bind_entities({'npcs': [{'id': 3, 'script': 2000}]}, {'global:0015': dispatch})
        self.assertEqual(result[0]['status'], 'matched-dispatch')
        self.assertEqual(result[0]['matches'][0]['program'], 'global:0015')
        self.assertEqual(result[0]['matches'][0]['functions'], [64])

    def test_colliding_lifecycle_case_is_not_silently_selected(self):
        dispatch = {'cases': [{'value': 1, 'target': 32}], 'tableOffset': 8, 'caseCalls': {}}
        result = bind_entities({'triggers2': [{'script': 1}]}, {'entities': dispatch, 'map': dispatch})
        self.assertEqual(result[0]['status'], 'ambiguous')
        self.assertEqual(len(result[0]['matches']), 2)

    def test_wrapper_links_only_exact_pattern(self):
        instructions = {0: {'opcode': 188, 'operands': [0], 'size': 4},
                        4: {'opcode': 49, 'offset': 4, 'target': 64, 'size': 8},
                        12: {'opcode': 51}}
        self.assertEqual(wrapper_calls(instructions, 0), [64])
        instructions[12]['opcode'] = 48
        self.assertEqual(wrapper_calls(instructions, 0), [])


if __name__ == '__main__':
    unittest.main()

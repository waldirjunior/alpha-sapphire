import unittest

from scripts.extract_event_memory import asset_manifest
from scripts.extract_opening_memory import memory_image


class EventMemoryTests(unittest.TestCase):
    def test_manifest_contains_only_identity_not_proprietary_memory(self):
        images = {'zone:0007:entities': {'sha256': 'synthetic', 'data': [1, 2], 'stackTop': 32}}
        self.assertEqual(asset_manifest(images), {'images': {'zone:0007:entities': {
            'sha256': 'synthetic', 'file': 'zone_0007_entities.json'}}})
        self.assertEqual(images['zone:0007:entities']['data'], [1, 2])

    def test_sha_mismatch_is_rejected_before_export(self):
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            memory_image({'sha256': 'wrong'}, 'expected')


if __name__ == '__main__':
    unittest.main()

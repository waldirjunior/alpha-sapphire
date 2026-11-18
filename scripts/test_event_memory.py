import unittest

from scripts.extract_event_memory import asset_manifest, local_memory_image
from scripts.extract_opening_memory import memory_image


class EventMemoryTests(unittest.TestCase):
    def test_manifest_contains_only_identity_not_proprietary_memory(self):
        images = {'zone:0007:entities': {'sha256': 'synthetic', 'data': [1, 2], 'stackTop': 32}}
        self.assertEqual(asset_manifest(images), {'images': {'zone:0007:entities': {
            'sha256': 'synthetic', 'file': 'zone_0007_entities.json'}}})
        self.assertEqual(images['zone:0007:entities']['data'], [1, 2])

    def test_local_exports_preserve_public_metadata_without_leaking_it_to_manifest(self):
        program = {'sha256': 'synthetic', 'dataCells': [7, 8],
                   'header': {'stp': 128, 'dat': 32},
                   'tables': {'publics': [{'identifier': 42, 'address': 12}]}}
        image = local_memory_image(program, 'synthetic')
        self.assertEqual(image, {'sha256': 'synthetic', 'data': [7, 8],
                                 'stackTop': 96, 'publics': {'42': 12}})
        manifest = asset_manifest({'zone:0001:map': image})
        self.assertNotIn('publics', manifest['images']['zone:0001:map'])

    def test_sha_mismatch_is_rejected_before_export(self):
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            memory_image({'sha256': 'wrong'}, 'expected')


if __name__ == '__main__':
    unittest.main()

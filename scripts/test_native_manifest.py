import io
import json
import struct
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
from build_native_manifest import character_job, encounter_scope, model_table_record, moving_clips, pokemon_job
from native_model_batch import conversion_error, manifest_summary, run_batch
from validate_native_manifest import sample_models, validate_model
from glb_native_clips import append_native_clip, decode_glb, encode_glb
from test_glb_native_clips import fixture


def mini_package(sections, magic=b'MM'):
    offset = 8 + len(sections) * 4
    pointers = [offset]
    for section in sections:
        offset += len(section)
        pointers.append(offset)
    return magic + struct.pack('<H', len(sections)) + struct.pack(f'<{len(pointers)}I', *pointers) + b''.join(sections)


def motion_pack():
    blob = bytearray(44)
    struct.pack_into('<I4I', blob, 0, 4, 20, 28, 0, 36)
    struct.pack_into('<HH', blob, 28, 7, 1)
    struct.pack_into('<HH', blob, 36, 7, 14)
    return bytes(blob)


def validation_fixture(root, external_image=False):
    scene, binary = fixture()
    if external_image:
        scene['images'] = [{'uri': 'diffuse.png'}]
    (root / 'base.glb').write_bytes(encode_glb(scene, binary))
    native, payload = append_native_clip(scene, binary, scene, binary, 'idle', {'sourceIndex': 0})
    (root / 'merged.glb').write_bytes(encode_glb(native, payload))
    return {'base_glb': 'base.glb', 'output': 'merged.glb', 'clips': {'idle': 0},
            'mapping': {'selected_frames': {'idle': 30}}}


class NativeManifestTests(unittest.TestCase):
    def test_model_table_maps_species_not_internal_model_name(self):
        table = struct.pack('<HBBHBBHBB', 0, 1, 1, 1, 1, 1, 2, 3, 7)
        self.assertEqual(model_table_record(table, 3, 1), {
            'table_slot': 0, 'table_offset': 8, 'first_model': 2, 'model_count': 3,
            'flags': 7, 'variant': 1, 'model_slot': 27, 'motion_slot': 32})

    def test_model_table_rejects_missing_variant(self):
        with self.assertRaisesRegex(ValueError, 'variant'):
            model_table_record(struct.pack('<HBB', 0, 1, 1), 1, 1)

    def test_character_selection_skips_static_pose_and_preserves_sparse_id(self):
        slots = [{'index': 0, 'frames': 1}, {'index': 2, 'frames': 14}, {'index': 93, 'frames': 36}]
        self.assertEqual(moving_clips(slots), {'overworld_002': 2})
        self.assertEqual(moving_clips([{'index': 17, 'frames': 20}]), {'overworld_017': 17})
        self.assertEqual(moving_clips([{'index': 0, 'frames': 1}]), {})

    def test_character_without_pack_is_reported(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'rom/extracted/garc/a_0_2_1/0007.bin'
            base = root / 'rom/extracted/models/characters/mm_0007/mm_0007.glb'
            source.parent.mkdir(parents=True)
            base.parent.mkdir(parents=True)
            source.write_bytes(mini_package([b'BCH\0']))
            base.write_bytes(b'base')
            job = character_job(root, 7)
            self.assertEqual(job['status'], 'no_motion_section')
            self.assertEqual(job['mapping']['model_section'], 0)

    def test_character_mapping_is_portable_and_records_pack(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'rom/extracted/garc/a_0_2_1/0007.bin'
            base = root / 'rom/extracted/models/characters/mm_0007/mm_0007.glb'
            source.parent.mkdir(parents=True)
            base.parent.mkdir(parents=True)
            source.write_bytes(mini_package([b'BCH\0', motion_pack()]))
            base.write_bytes(b'base')
            job = character_job(root, 7)
            self.assertEqual(job['status'], 'ready')
            self.assertEqual(job['clips'], {'overworld_002': 2})
            self.assertEqual(job['mapping']['motion_section'], 1)
            self.assertEqual(job['mapping']['present_indices'], [0, 2])
            self.assertNotIn(directory, json.dumps(job))

    def test_encounters_exclude_zero_and_union_supplements(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            zones = root / 'src/data/zones'
            zones.mkdir(parents=True)
            (zones / '023_route_101.json').write_text(json.dumps({
                'zone': 23, 'encounters': [{'species': 0}, {'species': 261}, {'species': 261}]}))
            scope = encounter_scope(root, (23,))
            self.assertEqual(scope['encounter_species'], [261])
            self.assertEqual(scope['species'], [*range(252, 261), 261, 382, 383])
            self.assertEqual(scope['zones'][0]['species'], [261])

    def test_report_counts_every_model_including_unsupported(self):
        report = manifest_summary([{'kind': 'character', 'status': 'merged', 'clips': {'walk': 2}},
                                   {'kind': 'character', 'status': 'no_motion_section'},
                                   {'kind': 'pokemon', 'status': 'failed', 'clips': {'idle': 0}}])
        self.assertEqual(report['models'], 3)
        self.assertEqual(report['status'], {'failed': 1, 'merged': 1, 'no_motion_section': 1})
        self.assertEqual(report['native_clips_merged'], 1)

    def test_internal_model_tag_does_not_need_to_equal_species(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base = root / 'rom/extracted/models/pokemon/pm0756_00/pm0756_00.glb'
            base.parent.mkdir(parents=True)
            base.write_bytes(b'base')
            table = bytearray(692 * 4)
            struct.pack_into('<HBB', table, 691 * 4, 969, 1, 1)
            pc = mini_package([b'BCH\0pm0756_00\0'], b'PC')
            pb = mini_package([motion_pack()], b'PB')
            with patch('build_native_manifest.read_garc_entry', side_effect=[pc, pb]):
                job = pokemon_job(root, root / 'rom/extracted/RomFS/a/0/0/8', bytes(table), 692, 0, {'zones': []})
            self.assertEqual(job['species'], 692)
            self.assertEqual(job['model_tag'], 'pm0756_00')
            self.assertEqual(job['model_slot'], 7755)
            self.assertEqual(job['status'], 'ready')

    def test_root_cause_is_not_hidden_by_called_process_error(self):
        log = ('ValueError: Native animation missing after COLLADA import: /var/folders/abc/clip.dae\n'
               'subprocess.CalledProcessError: command failed\n')
        tools = SimpleNamespace(spica_dll=Path('/tools/SPICA.dll'), blender=Path('/tools/blender'), dotnet=Path('/tools/dotnet'))
        error = conversion_error(log, Path('/root'), tools)
        self.assertEqual(error, 'ValueError: Native animation missing after COLLADA import: $TEMP')

    def test_batch_records_failure_and_continues(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            models = [{'id': name, 'kind': 'character', 'status': 'ready', 'clips': {'overworld_002': 2}}
                      for name in ('bad', 'good')]
            tools = SimpleNamespace(jobs=2)
            with patch('native_model_batch.run_model', side_effect=lambda root, job, tools:
                       {'status': 'failed', 'error': 'no skin'} if job['id'] == 'bad' else {'status': 'merged'}), redirect_stdout(io.StringIO()):
                report = run_batch({'models': models}, root, tools, root / 'report.json')
            self.assertEqual(report['summary']['status'], {'failed': 1, 'merged': 1})
            self.assertEqual(json.loads((root / 'report.json').read_text())['summary'], report['summary'])

    def test_validation_balances_character_and_pokemon_samples(self):
        models = [{'id': f'{kind}/{index}', 'kind': kind, 'status': 'merged'}
                  for kind in ('character', 'pokemon') for index in range(20)]
        selected = sample_models(models, 10)
        self.assertEqual(len(selected), 10)
        self.assertEqual(sum(model['kind'] == 'pokemon' for model in selected), 5)
        self.assertEqual(selected[0]['id'], 'character/0')
        self.assertEqual(selected[-1]['id'], 'pokemon/19')

    def test_validation_checks_native_duration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            job = validation_fixture(root)
            self.assertTrue(validate_model(root, job)['base_preserved'])
            job['mapping']['selected_frames']['idle'] = 60
            with self.assertRaisesRegex(ValueError, 'duration'):
                validate_model(root, job)

    def test_validation_rejects_modifying_original_accessors(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            job = validation_fixture(root)
            scene, binary = decode_glb((root / job['output']).read_bytes())
            scene['accessors'][0]['name'] = 'modified-original'
            (root / job['output']).write_bytes(encode_glb(scene, binary))
            with self.assertRaisesRegex(ValueError, 'accessors'):
                validate_model(root, job)

    def test_validation_rejects_external_images_when_relocating_glb(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            job = validation_fixture(root, external_image=True)
            with self.assertRaisesRegex(ValueError, 'image'):
                validate_model(root, job)


if __name__ == '__main__':
    unittest.main()

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parent))

from attach_native_motions import integrate_model, read_model_job
from glb_native_clips import decode_glb
from validate_native_manifest import verify_float_accessors

GARC = os.environ.get('ALPHA_TAILLOW_GARC')
SPICA_DLL = os.environ.get('ALPHA_SPICA_DLL')
BLENDER = os.environ.get('ALPHA_BLENDER')
DOTNET = os.environ.get('ALPHA_DOTNET', str(Path.home() / '.dotnet/dotnet'))
BASE_GLB = os.environ.get('ALPHA_TAILLOW_BASE_GLB')
TOOLS_AVAILABLE = all(path and Path(path).is_file() for path in (GARC, SPICA_DLL, BLENDER, DOTNET, BASE_GLB))


@unittest.skipUnless(TOOLS_AVAILABLE, 'Set ALPHA_TAILLOW_GARC, ALPHA_TAILLOW_BASE_GLB, ALPHA_SPICA_DLL, ALPHA_BLENDER, and ALPHA_DOTNET for the ROM export regression.')
class TaillowNativeExportTests(unittest.TestCase):
    def test_native_battle_clips_export_geometry_textures_skin_and_animation(self):
        with tempfile.TemporaryDirectory(prefix='taillow-native-clips-') as temporary:
            output = Path(temporary) / 'taillow.glb'
            job = {'source': GARC, 'model_slot': 3075, 'base_glb': BASE_GLB, 'output': str(output)}
            plan = read_model_job(job, Path('/'))
            tools = SimpleNamespace(spica_dll=Path(SPICA_DLL), blender=Path(BLENDER), dotnet=Path(DOTNET))
            integrate_model(plan, tools)
            scene, binary = decode_glb(output.read_bytes())

            self.assertTrue(scene.get('meshes'))
            self.assertTrue(scene.get('images'))
            self.assertTrue(scene.get('textures'))
            self.assertTrue(scene.get('skins'))
            self.assertEqual({animation['name'] for animation in scene.get('animations', [])},
                             {'idle', 'physical', 'special', 'damage', 'faint'})
            self.assertTrue(all(animation.get('channels') for animation in scene['animations']))
            verify_float_accessors(scene, binary)


if __name__ == '__main__':
    unittest.main()

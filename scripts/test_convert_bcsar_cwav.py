import json
import tempfile
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from scripts.convert_bcsar_cwav import convert_cwav_assets


def write_wave(path: Path) -> None:
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(22050)
        output.writeframes(b"\x00\x00")


class ConvertBcsarCwavTests(unittest.TestCase):
    def make_input(self, root: Path) -> Path:
        source = root / "input"
        source.mkdir()
        (source / "sample.cwav").write_bytes(b"CWAV synthetic fixture")
        (source / "sequence.cseq").write_bytes(b"CSEQ synthetic fixture")
        (source / "manifest.json").write_text(json.dumps({
            "assets": [
                {"fileId": 12, "signature": "CWAV", "extension": "cwav", "path": "sample.cwav", "size": 22},
                {"fileId": 13, "signature": "CSEQ", "extension": "cseq", "path": "sequence.cseq", "size": 22},
            ],
        }))
        return source

    def test_converts_only_manifest_cwav_assets_and_writes_conversion_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.make_input(root)
            output = root / "wav"

            def decode(arguments: list[str], **_kwargs: object) -> SimpleNamespace:
                write_wave(Path(arguments[arguments.index("-o") + 1]))
                return SimpleNamespace(returncode=0, stdout="", stderr="")

            with patch("scripts.convert_bcsar_cwav.subprocess.run", side_effect=decode) as run:
                manifest = convert_cwav_assets(source, output, "vgmstream-cli")

            self.assertEqual(run.call_count, 1)
            self.assertEqual(manifest["convertedCount"], 1)
            asset = manifest["assets"][0]
            self.assertEqual(asset["fileId"], 12)
            self.assertEqual(asset["source"], "sample.cwav")
            self.assertEqual(asset["path"], "sample.wav")
            self.assertTrue((output / "sample.wav").is_file())
            self.assertTrue((output / "conversion-manifest.json").is_file())

    def test_rejects_decoder_output_that_is_not_a_playable_wave(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.make_input(root)

            def invalid_decode(arguments: list[str], **_kwargs: object) -> SimpleNamespace:
                Path(arguments[arguments.index("-o") + 1]).write_bytes(b"not a wave")
                return SimpleNamespace(returncode=0, stdout="", stderr="")

            with patch("scripts.convert_bcsar_cwav.subprocess.run", side_effect=invalid_decode):
                with self.assertRaisesRegex(ValueError, "WAV inválido"):
                    convert_cwav_assets(source, root / "wav", "vgmstream-cli")

    def test_reports_missing_decoder_with_actionable_name(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.make_input(root)

            with patch("scripts.convert_bcsar_cwav.subprocess.run", side_effect=FileNotFoundError):
                with self.assertRaisesRegex(RuntimeError, "decoder 'missing-vgmstream'"):
                    convert_cwav_assets(source, root / "wav", "missing-vgmstream")


if __name__ == "__main__":
    unittest.main()

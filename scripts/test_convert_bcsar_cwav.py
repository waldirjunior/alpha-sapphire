import json
import struct
import tempfile
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from scripts.convert_bcsar_cwav import (
    build_seplay_sample_catalog,
    classify_cwav_candidates,
    convert_cwav_assets,
    read_sequence_bank_item_ids,
    resolve_one_seplay_chain,
)


def write_wave(path: Path) -> None:
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(22050)
        output.writeframes(b"\x01\x00")


class ConvertBcsarCwavTests(unittest.TestCase):
    def test_reads_only_typed_sequence_bank_references(self) -> None:
        detail = bytearray(0x78)
        struct.pack_into("<I", detail, 0x10, 0x03000005)
        struct.pack_into("<I", detail, 0x74, 0x03000051)

        self.assertEqual(read_sequence_bank_item_ids(bytes(detail)), [5, 81])

    def test_marks_sample_chains_unique_ambiguous_or_missing_without_aliasing(self) -> None:
        self.assertEqual(classify_cwav_candidates(["message.cwav"]), "unique")
        self.assertEqual(classify_cwav_candidates(["bank-a.cwav", "bank-b.cwav"]), "ambiguous")
        self.assertEqual(classify_cwav_candidates([]), "missing")

    def test_sample_catalog_contains_only_decoded_unique_chains(self) -> None:
        rows = [
            {"bcsarIndex": 669, "label": "SEQ_SE_FLD_210", "status": "unique", "candidates": [{"cwavPath": "unique.cwav"}]},
            {"bcsarIndex": 261, "label": "SEQ_SE_MESSAGE", "status": "ambiguous", "candidates": [{"cwavPath": "a.cwav"}, {"cwavPath": "b.cwav"}]},
            {"bcsarIndex": 358, "label": "SEQ_SE_SYS_066", "status": "unique", "candidates": [{"cwavPath": "failed.cwav"}]},
        ]

        self.assertEqual(build_seplay_sample_catalog(rows, {(669, "unique.cwav")}), {
            "669": {
                "label": "SEQ_SE_FLD_210",
                "url": "/assets/audio/sfx/bcsar_669_SEQ_SE_FLD_210.wav",
            },
        })

    def test_follows_each_sequence_bank_to_its_cwar_and_keeps_ambiguous_samples_separate(self) -> None:
        bcsar = bytearray(64)
        struct.pack_into("<I", bcsar, 8, 12)
        struct.pack_into("<I", bcsar, 24, 22)
        struct.pack_into("<I", bcsar, 28, 23)
        struct.pack_into("<I", bcsar, 32, 33)
        struct.pack_into("<I", bcsar, 36, 34)
        assets = [
            {"fileId": 33, "signature": "CWAV", "path": "first.cwav"},
            {"fileId": 34, "signature": "CWAV", "path": "second.cwav"},
        ]
        with patch("scripts.convert_bcsar_cwav.read_ref", return_value=(0x2203, 48)), \
                patch("scripts.convert_bcsar_cwav.read_sequence_bank_item_ids", return_value=[0, 1]), \
                patch("scripts.convert_bcsar_cwav.read_bank_wave_archive_ids", side_effect=[[0], [1]]), \
                patch("scripts.convert_bcsar_cwav.bcsar_file_payload", side_effect=[b"CSEQ", b"CBNK", b"CWAR", b"CBNK", b"CWAR"]), \
                patch("scripts.convert_bcsar_cwav.cwav_source_exists", return_value=True):
            row = resolve_one_seplay_chain(
                "0x000A001D", {"bcsarIndex": 409, "label": "SEQ_SE_FLD_KAIDAN"}, bytes(bcsar), Path("."),
                assets, [(0, 0)] * 409 + [(0x2200, 4)], [(0x2206, 24), (0x2206, 28)],
                [(0x2207, 32), (0x2207, 36)],
            )

        self.assertEqual(row["status"], "ambiguous")
        self.assertEqual([candidate["cwavPath"] for candidate in row["candidates"]], ["first.cwav", "second.cwav"])

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
            decoder_inputs: list[tuple[str, bytes]] = []
            decoder_arguments: list[list[str]] = []

            def decode(arguments: list[str], **_kwargs: object) -> SimpleNamespace:
                decoder_arguments.append(arguments)
                decoder_source = Path(arguments[-1])
                decoder_inputs.append((decoder_source.suffix, decoder_source.read_bytes()))
                write_wave(Path(arguments[arguments.index("-o") + 1]))
                return SimpleNamespace(returncode=0, stdout="", stderr="")

            with patch("scripts.convert_bcsar_cwav.subprocess.run", side_effect=decode) as run:
                manifest = convert_cwav_assets(source, output, "vgmstream-cli")

            self.assertEqual(run.call_count, 1)
            self.assertEqual(decoder_inputs, [(".bcwav", b"CWAV synthetic fixture")])
            self.assertIn("-i", decoder_arguments[0])
            self.assertEqual(manifest["convertedCount"], 1)
            asset = manifest["assets"][0]
            self.assertEqual(asset["fileId"], 12)
            self.assertEqual(asset["source"], "sample.cwav")
            self.assertEqual(asset["path"], "sample.wav")
            self.assertTrue((output / "sample.wav").is_file())
            self.assertTrue((output / "conversion-manifest.json").is_file())

    def test_converts_only_the_selected_sample_with_a_bcsar_sound_name(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.make_input(root)
            output = root / "wav"

            def decode(arguments: list[str], **_kwargs: object) -> SimpleNamespace:
                write_wave(Path(arguments[arguments.index("-o") + 1]))
                return SimpleNamespace(returncode=0, stdout="", stderr="")

            with patch("scripts.convert_bcsar_cwav.subprocess.run", side_effect=decode) as run:
                manifest = convert_cwav_assets(
                    source, output, "vgmstream-cli",
                    output_names={"sample.cwav": "bcsar_343_SEQ_SE_RECOVERY.wav"},
                )

            self.assertEqual(run.call_count, 1)
            self.assertEqual(manifest["convertedCount"], 1)
            self.assertEqual(manifest["assets"][0]["path"], "bcsar_343_SEQ_SE_RECOVERY.wav")
            self.assertTrue((output / "bcsar_343_SEQ_SE_RECOVERY.wav").is_file())
            self.assertFalse((output / "sample.wav").exists())

    def test_converts_multiple_selected_samples_and_records_all_output_paths(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.make_input(root)
            (source / "second.cwav").write_bytes(b"second CWAV synthetic fixture")
            manifest_path = source / "manifest.json"
            manifest = json.loads(manifest_path.read_text())
            manifest["assets"].append({
                "fileId": 14, "signature": "CWAV", "extension": "cwav", "path": "second.cwav", "size": 30,
            })
            manifest_path.write_text(json.dumps(manifest))
            output = root / "wav"

            def decode(arguments: list[str], **_kwargs: object) -> SimpleNamespace:
                write_wave(Path(arguments[arguments.index("-o") + 1]))
                return SimpleNamespace(returncode=0, stdout="", stderr="")

            with patch("scripts.convert_bcsar_cwav.subprocess.run", side_effect=decode) as run:
                result = convert_cwav_assets(source, output, "vgmstream-cli", {
                    "sample.cwav": "bcsar_261_SEQ_SE_MESSAGE.wav",
                    "second.cwav": "bcsar_262_SEQ_SE_DECIDE1.wav",
                })

            self.assertEqual(run.call_count, 2)
            self.assertEqual(result["convertedCount"], 2)
            self.assertEqual(
                [asset["path"] for asset in result["assets"]],
                ["bcsar_261_SEQ_SE_MESSAGE.wav", "bcsar_262_SEQ_SE_DECIDE1.wav"],
            )
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

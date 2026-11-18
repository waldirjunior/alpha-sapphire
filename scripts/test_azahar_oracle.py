import socket
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts.azahar_movie import (AZAHAR_REVISION, HEADER_SIZE, Step, build_movie, button_mask, encode_inputs, hold,
                                  pad_updates, press, tap, wait)
from scripts.azahar_movies import MOVIES
from scripts.azahar_rpc import HEADER, PORT as RPC_PORT, PROCESS_LIST, READ_MEMORY, decode_reply, encode_request, parse_process_list
from scripts.azahar_session import (PROFILE_SETTINGS, EmulatorProcess, apply_settings, launch_command, rpc_port_in_use,
                                    save_path)

ORAS = 0x000400000011C500
INI = "[Debugging]\nenable_rpc_server=false\nenable_rpc_server\\default=true\n[System]\ninit_clock=0\ninit_clock\\default=true\n[UI]\ntheme=dark\n"


class RpcPacketTest(unittest.TestCase):
    def test_request_carries_version_id_kind_and_size(self) -> None:
        packet = encode_request(0xABCD, READ_MEMORY, struct.pack("<II", 0x100000, 8))
        self.assertEqual(HEADER.unpack_from(packet), (2, 0xABCD, READ_MEMORY, 8))
        self.assertEqual(packet[HEADER.size:], struct.pack("<II", 0x100000, 8))

    def test_reply_is_accepted_only_for_the_matching_request(self) -> None:
        reply = HEADER.pack(2, 7, READ_MEMORY, 4) + b"\x07\x00\x00\xeb"
        self.assertEqual(decode_reply(reply, 7, READ_MEMORY), b"\x07\x00\x00\xeb")
        self.assertIsNone(decode_reply(reply, 8, READ_MEMORY))
        self.assertIsNone(decode_reply(reply, 7, PROCESS_LIST))
        self.assertIsNone(decode_reply(reply[:-1], 7, READ_MEMORY))
        self.assertIsNone(decode_reply(b"\x00", 7, READ_MEMORY))

    def test_process_list_maps_pid_to_title_and_name(self) -> None:
        body = struct.pack("<I", 1) + struct.pack("<IQ8s", 11, ORAS, b"sango-2\0")
        self.assertEqual(parse_process_list(body), {11: (ORAS, "sango-2")})


class MovieTest(unittest.TestCase):
    def test_each_pad_update_writes_a_pad_and_a_touch_record(self) -> None:
        inputs, pad_count = encode_inputs([hold(60, "a")])
        self.assertEqual(pad_count, pad_updates(60))
        self.assertEqual(len(inputs), pad_count * 14)
        self.assertEqual(inputs[:7], bytes([0, 1, 0, 0, 0, 0, 0]))
        self.assertEqual(inputs[7:14], bytes([1, 0, 0, 0, 0, 0, 0]))

    def test_buttons_follow_the_hid_bit_order(self) -> None:
        self.assertEqual(button_mask(("a", "start", "down", "x")), 0b0000_0100_1000_1001)
        with self.assertRaisesRegex(ValueError, "Botão desconhecido: zl"):
            button_mask(("zl",))

    def test_touch_marks_the_record_valid_with_coordinates(self) -> None:
        inputs, _count = encode_inputs([tap(160, 120, frames=1)])
        self.assertEqual(struct.unpack_from("<BHHB", inputs, 7), (1, 160, 120, 1))

    def test_rounding_does_not_drift_across_many_short_steps(self) -> None:
        _inputs, pad_count = encode_inputs([wait(1)] * 600)
        self.assertEqual(pad_count, pad_updates(600))

    def test_header_identifies_title_revision_clock_and_input_count(self) -> None:
        movie = build_movie([*press("a")], ORAS, 1416528000)
        magic, program, revision, init_time, movie_id = struct.unpack_from("<4sQ20sQQ", movie)
        self.assertEqual((magic, program, revision, init_time, movie_id), (b"CTM\x1b", ORAS, AZAHAR_REVISION, 1416528000, 1))
        self.assertEqual(struct.unpack_from("<Q", movie, 0x54)[0], pad_updates(18))
        self.assertEqual(len(movie), HEADER_SIZE + pad_updates(18) * 14)

    def test_known_movies_only_use_valid_steps(self) -> None:
        for name, steps in MOVIES.items():
            with self.subTest(movie=name):
                self.assertTrue(all(isinstance(step, Step) and step.frames > 0 for step in steps))
                encode_inputs(steps)


class ProfileTest(unittest.TestCase):
    def test_overrides_existing_keys_and_marks_them_non_default(self) -> None:
        ini = apply_settings(INI, {("Debugging", "enable_rpc_server"): "true"})
        self.assertIn("[Debugging]\nenable_rpc_server=true\nenable_rpc_server\\default=false\n", ini)
        self.assertNotIn("enable_rpc_server=false", ini)
        self.assertIn("init_clock=0\ninit_clock\\default=true", ini)

    def test_adds_keys_the_emulator_has_not_written_yet(self) -> None:
        ini = apply_settings(INI, {("UI", "firstStart"): "false"})
        self.assertIn("[UI]\nfirstStart=false\nfirstStart\\default=false\ntheme=dark\n", ini)

    def test_is_idempotent(self) -> None:
        once = apply_settings(INI, {("System", "init_clock"): "1"})
        self.assertEqual(apply_settings(once, {("System", "init_clock"): "1"}), once)

    def test_rejects_a_config_without_the_expected_section(self) -> None:
        with self.assertRaisesRegex(KeyError, "Renderer"):
            apply_settings(INI, {("Renderer", "frame_limit"): "400"})

    def test_profile_enables_rpc_and_fixes_the_clock(self) -> None:
        self.assertEqual(PROFILE_SETTINGS[("Debugging", "enable_rpc_server")], "true")
        self.assertEqual(PROFILE_SETTINGS[("System", "init_clock")], "1")


class LaunchTest(unittest.TestCase):
    def test_macos_launch_goes_through_open_with_the_isolated_profile(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            command = launch_command(Path("/apps/Azahar.app"), home, ["-p", "movie.ctm", "game.3ds"])
            self.assertTrue((home / "data" / "azahar-emu").is_dir())
        self.assertEqual(command[:5], ["open", "-n", "-g", "-a", "/apps/Azahar.app"])
        self.assertIn(f"XDG_DATA_HOME={home / 'data'}", command)
        self.assertEqual(command[-4:], ["--args", "-p", "movie.ctm", "game.3ds"])

    def test_save_lives_under_the_title_id_of_the_cartridge(self) -> None:
        self.assertTrue(str(save_path(Path("/p"))).endswith("title/00040000/0011c500/data/00000001/main"))

    def test_emulator_process_stops_a_spawned_process_group(self) -> None:
        child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"], start_new_session=True)
        try:
            EmulatorProcess(child).stop(grace_seconds=2.0)
            self.assertIsNotNone(child.poll())
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()

    def test_rpc_port_in_use_detects_bound_udp_socket(self) -> None:
        if rpc_port_in_use():
            self.skipTest(f"Porta RPC {RPC_PORT} já está em uso fora do teste")
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.bind(("0.0.0.0", RPC_PORT))
            self.assertTrue(rpc_port_in_use())
        self.assertFalse(rpc_port_in_use())


if __name__ == "__main__":
    unittest.main()

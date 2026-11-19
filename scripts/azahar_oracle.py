#!/usr/bin/env python3
"""Linha de comando do oráculo: prepara o perfil do Azahar, confere a instalação e reproduz roteiros.

    python3 -m scripts.azahar_oracle init
    python3 -m scripts.azahar_oracle check
    python3 -m scripts.azahar_oracle play mash_to_name_entry --at 60,120,200 --speed 400

Tutorial completo: docs/features/validacao-emulador/setup-emulador.md
"""

from __future__ import annotations

import argparse
import math
import re
import struct
import time
import zlib
from pathlib import Path
from typing import Protocol

from scripts.azahar_movie import Step, build_movie, wait
from scripts.azahar_movies import MOVIES, SECOND
from scripts.azahar_session import (ORAS_TITLE_ID, PROFILE_SETTINGS, AzaharSession, configure_profile, emulator_home,
                                    generate_profile, main_checkout, save_path)
from scripts.oras_save import relocate_save, zone_transform

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
TOP_SCREEN_HEIGHT = 240
PNG_CHANNELS = {0: 1, 2: 3, 4: 2, 6: 4}
SCENARIOS_PATH = Path(__file__).resolve().parent.parent / "src" / "visual" / "scenarios.ts"
SCENARIO_CALL_RE = re.compile(r"\b(closeup|overworld)\(\s*(['\"])([^'\"]+)\2\s*,([^)]+)\)")
ARM_CODE_BASE = 0x00100000
# Bloco vivo do estado de mapa/jogador na RAM do processo (`sango-2`, US v1.0): `zone` (u32) + `<fff` world pos.
PLAYER_ZONE_ADDR = 0x08187BD4
PLAYER_WORLD_POS_ADDR = 0x08187BF4
# Depois do roteiro o filme segue com 10 min sem entrada: ao acabar o filme o emulador volta a ler o teclado real.
IDLE_TAIL = wait(600 * SECOND)


class MemoryReader(Protocol):
    def read(self, address: int, size: int) -> bytes: ...


def player_world_position(rpc: MemoryReader) -> tuple[float, float, float]:
    """Lê a posição viva `(world_x, world_y, world_z)` do jogador na RAM do processo."""
    wx, wy, wz = struct.unpack("<fff", rpc.read(PLAYER_WORLD_POS_ADDR, 12))
    if not (math.isfinite(wx) and math.isfinite(wy) and math.isfinite(wz)):
        raise ValueError(f"Coordenada viva inválida em 0x{PLAYER_WORLD_POS_ADDR:08x}: {(wx, wy, wz)}")
    return wx, wy, wz


def player_cell(rpc: MemoryReader, zone_id: int | None = None) -> tuple[int, int]:
    """Converte a posição viva da RAM em célula `(tile_x, tile_z)` local da zona."""
    zone = zone_id if zone_id is not None else struct.unpack("<I", rpc.read(PLAYER_ZONE_ADDR, 4))[0]
    wx, _wy, wz = player_world_position(rpc)
    ox, oz, scale, _h = zone_transform(zone, 0.0, 0.0, 0.0)
    return math.floor(wx / scale - ox), math.floor(wz / scale - oz)


def compress_cell_trace(cells: list[tuple[int, int]]) -> list[dict[str, int]]:
    """Remove duplicatas consecutivas preservando a sequência exata de células distintas visitadas."""
    distinct: list[tuple[int, int]] = []
    for cell in cells:
        if not distinct or distinct[-1] != cell:
            distinct.append(cell)
    return [{"x": x, "z": z} for x, z in distinct]


def init_profile() -> Path:
    home = emulator_home()
    home.mkdir(parents=True, exist_ok=True)
    config = generate_profile(home)
    configure_profile(home)
    return config


def capture_frames(steps: list[Step], seconds: list[float], speed_percent: int, prefix: Path) -> list[Path]:
    """Reproduz o roteiro desde o boot e salva um PNG em cada instante emulado pedido."""
    init_time = int(PROFILE_SETTINGS[("System", "init_time")])
    movie = build_movie([*steps, IDLE_TAIL], ORAS_TITLE_ID, init_time)
    prefix.parent.mkdir(parents=True, exist_ok=True)
    saved = []
    with AzaharSession(movie=movie, speed_percent=speed_percent) as session:
        started = time.monotonic()
        for index, second in enumerate(seconds):
            # Tempo emulado ≈ tempo de parede × velocidade, válido enquanto a máquina sustenta a velocidade pedida.
            time.sleep(max(0.0, started + second * 100 / speed_percent - time.monotonic()))
            path = prefix.with_name(f"{prefix.name}-{index:02d}.png")
            path.write_bytes(session.rpc.screenshot_png())
            saved.append(path)
    return saved


def check_installation() -> Path:
    """Sobe o jogo, lê memória do processo e captura o título; falha com a causa se algo não responder."""
    home = emulator_home()
    movie = build_movie([*MOVIES["boot_to_title"], IDLE_TAIL], ORAS_TITLE_ID, int(PROFILE_SETTINGS[("System", "init_time")]))
    with AzaharSession(movie=movie) as session:
        code = session.rpc.read(ARM_CODE_BASE, 8)
        time.sleep(26)
        png = session.rpc.screenshot_png()
    if not any(code) or not png.startswith(PNG_MAGIC):
        raise RuntimeError(f"RPC respondeu sem dados válidos (código {code.hex()}, {len(png)} bytes de imagem)")
    target = home / "check.png"
    target.write_bytes(png)
    return target


def _png_chunk(tag: bytes, payload: bytes) -> bytes:
    crc = zlib.crc32(tag + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + tag + payload + struct.pack(">I", crc)


def crop_top_screen_png(png_bytes: bytes, top_height: int = TOP_SCREEN_HEIGHT) -> bytes:
    """Recorta o PNG 400×480 do Azahar para os `top_height` primeiros pixels (tela superior 400×240)."""
    if not png_bytes.startswith(PNG_MAGIC):
        raise ValueError("Dados não começam com assinatura PNG válida")
    pos = len(PNG_MAGIC)
    ihdr: tuple[int, int, int, int, int, int, int] | None = None
    idat = bytearray()
    while pos + 12 <= len(png_bytes):
        length, tag = struct.unpack_from(">I4s", png_bytes, pos)
        payload = png_bytes[pos + 8 : pos + 8 + length]
        if tag == b"IHDR":
            ihdr = struct.unpack(">IIBBBBB", payload)
        elif tag == b"IDAT":
            idat.extend(payload)
        elif tag == b"IEND":
            break
        pos += 12 + length
    if ihdr is None or not idat:
        raise ValueError("PNG sem cabeçalho IHDR ou bloco IDAT")
    width, height, bit_depth, color_type, comp, flt, interlace = ihdr
    if bit_depth != 8 or comp != 0 or flt != 0 or interlace != 0 or color_type not in PNG_CHANNELS:
        raise ValueError(f"Formato PNG não suportado para recorte: IHDR={ihdr}")
    if not (0 < top_height <= height):
        raise ValueError(f"Altura de recorte inválida ({top_height}) para imagem {width}x{height}")

    stride = 1 + width * PNG_CHANNELS[color_type]
    raw_scanlines = zlib.decompress(bytes(idat))
    if len(raw_scanlines) < top_height * stride:
        raise ValueError(f"IDAT curto demais: {len(raw_scanlines)} bytes; mínimo {top_height * stride}")
    new_ihdr = struct.pack(">IIBBBBB", width, top_height, bit_depth, color_type, comp, flt, interlace)
    return PNG_MAGIC + _png_chunk(b"IHDR", new_ihdr) + _png_chunk(b"IDAT", zlib.compress(raw_scanlines[: top_height * stride])) + _png_chunk(b"IEND", b"")


def load_visual_scenarios(scenarios_ts: Path = SCENARIOS_PATH) -> list[dict[str, int | str]]:
    """Extrai `(id, zone, x, z)` dos cenários declarados em `src/visual/scenarios.ts`."""
    scenarios: list[dict[str, int | str]] = []
    for match in SCENARIO_CALL_RE.finditer(scenarios_ts.read_text()):
        kind, _quote, scenario_id, raw_args = match.groups()
        if kind == "closeup":
            scenarios.append({"id": scenario_id, "zone": 6, "x": 17, "z": 14})
        else:
            zone_s, x_s, z_s = [part.strip() for part in raw_args.split(",")[:3]]
            scenarios.append({"id": scenario_id, "zone": int(zone_s), "x": int(x_s), "z": int(z_s)})
    return scenarios


def visual_reference_dir() -> Path:
    return main_checkout() / "rom" / "visual-reference"


def capture_visual_references(
    selected_ids: list[str] | None = None,
    speed_percent: int = 400,
    capture_at: float = 48.0,
    base_save: Path | None = None,
    out_dir: Path | None = None,
) -> list[Path]:
    """Gera recortes 400×240 da tela superior no Azahar para os cenários de `src/visual/scenarios.ts`."""
    home = emulator_home()
    source_save = base_save or (home / "first_save.main")
    base_bytes = source_save.read_bytes()
    target_dir = out_dir or visual_reference_dir()
    target_dir.mkdir(parents=True, exist_ok=True)

    wanted = set(selected_ids) if selected_ids else None
    scenarios = [item for item in load_visual_scenarios() if wanted is None or item["id"] in wanted]
    if wanted:
        missing = sorted(wanted - {str(item["id"]) for item in scenarios})
        if missing:
            raise ValueError(f"Cenários visuais desconhecidos: {', '.join(missing)}")

    init_time = int(PROFILE_SETTINGS[("System", "init_time")])
    movie = build_movie([*MOVIES["continue_game"], IDLE_TAIL], ORAS_TITLE_ID, init_time)
    saved_paths: list[Path] = []
    for item in scenarios:
        scenario_id = str(item["id"])
        zone, x, z = int(item["zone"]), int(item["x"]), int(item["z"])
        ox, oz, scale, height = zone_transform(zone, x, z, None)
        relocated = relocate_save(base_bytes, zone, x, z, height, origin_x=ox, origin_z=oz, units_per_tile=scale)
        save_path(home).write_bytes(relocated)
        with AzaharSession(movie=movie, speed_percent=speed_percent) as session:
            time.sleep(max(0.0, capture_at * 100 / speed_percent))
            raw_png = session.rpc.screenshot_png()
        out_path = target_dir / f"{scenario_id}.png"
        out_path.write_bytes(crop_top_screen_png(raw_png))
        saved_paths.append(out_path)
    return saved_paths


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init", help="gera e configura o perfil isolado em rom/emulator/")
    commands.add_parser("check", help="boota o jogo, lê memória e captura o título em rom/emulator/check.png")
    play = commands.add_parser("play", help="reproduz um roteiro e captura frames")
    play.add_argument("movie", choices=sorted(MOVIES))
    play.add_argument("--at", required=True, help="instantes emulados em segundos, separados por vírgula")
    play.add_argument("--speed", type=int, default=100, help="velocidade do emulador em %% (padrão 100)")
    play.add_argument("--out", type=Path, help="prefixo dos PNGs (padrão rom/emulator/frames/<roteiro>)")
    refs = commands.add_parser("capture-references", help="captura 400×240 dos cenários visuais em rom/visual-reference/")
    refs.add_argument("--scenario", action="append", help="filtra um ou mais IDs de cenário")
    refs.add_argument("--speed", type=int, default=400, help="velocidade do emulador em %% (padrão 400)")
    refs.add_argument("--at", type=float, default=48.0, help="instante emulado de captura em segundos (padrão 48.0)")
    args = parser.parse_args()

    if args.command == "init":
        print(f"Perfil pronto: {init_profile()}")
    elif args.command == "check":
        print(f"Oráculo OK: jogo iniciou, memória lida e frame salvo em {check_installation()}")
    elif args.command == "capture-references":
        for path in capture_visual_references(args.scenario, speed_percent=args.speed, capture_at=args.at):
            print(path)
    else:
        prefix = args.out or emulator_home() / "frames" / args.movie
        for path in capture_frames(MOVIES[args.movie], [float(value) for value in args.at.split(",")], args.speed, prefix):
            print(path)


if __name__ == "__main__":
    main()

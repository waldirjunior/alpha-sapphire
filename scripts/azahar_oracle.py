#!/usr/bin/env python3
"""Linha de comando do oráculo: prepara o perfil do Azahar, confere a instalação e reproduz roteiros.

    python3 -m scripts.azahar_oracle init
    python3 -m scripts.azahar_oracle check
    python3 -m scripts.azahar_oracle play mash_to_name_entry --at 60,120,200 --speed 400

Tutorial completo: docs/features/validacao-emulador/setup-emulador.md
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from scripts.azahar_movie import Step, build_movie, wait
from scripts.azahar_movies import MOVIES, SECOND
from scripts.azahar_session import (ORAS_TITLE_ID, PROFILE_SETTINGS, AzaharSession, configure_profile, emulator_home,
                                    generate_profile)

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
ARM_CODE_BASE = 0x00100000
# Depois do roteiro o filme segue com 10 min sem entrada: ao acabar o filme o emulador volta a ler o teclado real.
IDLE_TAIL = wait(600 * SECOND)


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
    args = parser.parse_args()

    if args.command == "init":
        print(f"Perfil pronto: {init_profile()}")
    elif args.command == "check":
        print(f"Oráculo OK: jogo iniciou, memória lida e frame salvo em {check_installation()}")
    else:
        prefix = args.out or emulator_home() / "frames" / args.movie
        for path in capture_frames(MOVIES[args.movie], [float(value) for value in args.at.split(",")], args.speed, prefix):
            print(path)


if __name__ == "__main__":
    main()

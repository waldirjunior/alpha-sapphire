"""Gera filmes de entrada (.ctm) do Azahar a partir de uma linha do tempo de botões.

O filme é a única via determinística de entrada: o emulador o reproduz desde o boot, tick a tick,
sem depender de foco de janela nem de permissão de acessibilidade do sistema.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass

MAGIC = b"CTM\x1b"
HEADER_SIZE = 256
RECORD = struct.Struct("<BHhh")
TOUCH_RECORD = struct.Struct("<BHHBx")
PAD_AND_CIRCLE = 0
TOUCH = 1

# O HID do 3DS atualiza o pad a 234 Hz e cada atualização consome um registro de pad e um de toque.
PAD_UPDATES_PER_SECOND = 234
FRAMES_PER_SECOND = 59.8261

BUTTON_BITS = {"a": 0, "b": 1, "select": 2, "start": 3, "right": 4, "left": 5, "up": 6, "down": 7,
               "r": 8, "l": 9, "x": 10, "y": 11}

# Revisão git do Azahar 2126.2; o emulador avisa (sem bloquear) quando o filme vem de outra revisão.
AZAHAR_REVISION = bytes.fromhex("219d743a1e698101fe1ab8bef43e6563126c3c27")


@dataclass(frozen=True)
class Step:
    """Botões mantidos (e toque opcional na tela inferior, 320×240) por uma quantidade de frames."""
    frames: int
    buttons: tuple[str, ...] = ()
    touch: tuple[int, int] | None = None


def hold(frames: int, *buttons: str) -> Step:
    return Step(frames, buttons)


def wait(frames: int) -> Step:
    return Step(frames)


def tap(x: int, y: int, frames: int = 6) -> Step:
    return Step(frames, (), (x, y))


def press(button: str, held: int = 6, released: int = 12) -> list[Step]:
    return [hold(held, button), wait(released)]


def button_mask(buttons: tuple[str, ...]) -> int:
    unknown = [name for name in buttons if name not in BUTTON_BITS]
    if unknown:
        raise ValueError(f"Botão desconhecido: {unknown[0]}; esperado um de {sorted(BUTTON_BITS)}")
    return sum(1 << BUTTON_BITS[name] for name in buttons)


def pad_updates(frames: float) -> int:
    return round(frames * PAD_UPDATES_PER_SECOND / FRAMES_PER_SECOND)


def encode_inputs(steps: list[Step]) -> tuple[bytes, int]:
    """Registros intercalados pad/toque e a quantidade de registros de pad."""
    records = bytearray()
    elapsed_frames = 0.0
    written = 0
    for step in steps:
        elapsed_frames += step.frames
        pad = RECORD.pack(PAD_AND_CIRCLE, button_mask(step.buttons), 0, 0)
        touch = TOUCH_RECORD.pack(TOUCH, *(step.touch or (0, 0)), 1 if step.touch else 0)
        # Acumular em frames e converter o total evita deriva de arredondamento entre passos.
        count = pad_updates(elapsed_frames) - written
        records += (pad + touch) * count
        written += count
    return bytes(records), written


def build_movie(steps: list[Step], program_id: int, init_time: int, movie_id: int = 1) -> bytes:
    inputs, pad_count = encode_inputs(steps)
    header = struct.pack("<4sQ20sQQ32sIQq", MAGIC, program_id, AZAHAR_REVISION, init_time, movie_id,
                         b"alpha-sapphire", 0, pad_count, 0)
    return header.ljust(HEADER_SIZE, b"\0") + inputs


def total_frames(steps: list[Step]) -> int:
    return sum(step.frames for step in steps)

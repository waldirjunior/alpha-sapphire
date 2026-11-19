"""Roteiros de entrada conhecidos para o Azahar. Cada um parte do boot com save vazio."""

from __future__ import annotations

from scripts.azahar_movie import Step, hold, press, tap, wait

SECOND = 60


def _repeat(times: int, chunk: list[Step]) -> list[Step]:
    return [step for _ in range(times) for step in chunk]


# Seleção de idioma (inglês) e confirmação; aos ~25 s emulados o logotipo do título está na tela.
BOOT_TO_TITLE: list[Step] = [wait(12 * SECOND), *press("a"), wait(4 * SECOND), *press("a"), wait(8 * SECOND)]

# A a cada 0,4 s atravessa título, fala do Prof. Birch e escolha de gênero (padrão: garoto) e para
# no teclado de nome entre 190 e 200 s emulados (mantido como marco de referência do boot limpo).
MASH_TO_NAME_ENTRY: list[Step] = [wait(12 * SECOND), *_repeat(480, press("a", 4, 20))]

# Save limpo inicial: atravessa intro, apaga eventuais '!', digita "a", sai do caminhão e salva no 1F da casa.
INTRO_TO_FIRST_SAVE: list[Step] = [
    wait(12 * SECOND),
    *_repeat(175, press("a", 4, 20)),
    wait(2 * SECOND),
    *_repeat(5, [*press("a", 4, 20), wait(150)]),
    wait(3 * SECOND),
    *_repeat(2, [tap(264, 72, 12), wait(30)]),
    wait(30),
    tap(55, 148, 12),
    wait(SECOND),
    tap(259, 110, 12),
    wait(3 * SECOND),
    *press("a", 6, 30),
    wait(2 * SECOND),
    *_repeat(120, press("a", 4, 20)),
    hold(120, "right"),
    wait(6 * SECOND),
    *_repeat(140, press("a", 4, 20)),
    wait(4 * SECOND),
    *press("x", 6, 30),
    wait(2 * SECOND),
    *press("down", 6, 24),
    wait(30),
    *press("a", 6, 30),
    wait(3 * SECOND),
    *press("a", 6, 30),
    wait(2 * SECOND),
    *press("a", 6, 30),
    wait(15 * SECOND),
]

# Carrega o save existente em ~21 s emulados (título → Continue → controle livre no jogo).
CONTINUE_GAME: list[Step] = [
    wait(10 * SECOND),
    *_repeat(8, [*press("a", 4, 20), wait(SECOND)]),
    wait(4 * SECOND),
]

MOVIES: dict[str, list[Step]] = {
    "boot_to_title": BOOT_TO_TITLE,
    "mash_to_name_entry": MASH_TO_NAME_ENTRY,
    "intro_to_first_save": INTRO_TO_FIRST_SAVE,
    "continue_game": CONTINUE_GAME,
}

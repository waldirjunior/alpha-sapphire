"""Roteiros de entrada conhecidos para o Azahar. Cada um parte do boot com save vazio."""

from __future__ import annotations

from scripts.azahar_movie import Step, press, wait

SECOND = 60

# Seleção de idioma (inglês) e confirmação; aos ~25 s emulados o logotipo do título está na tela.
BOOT_TO_TITLE: list[Step] = [wait(12 * SECOND), *press("a"), wait(4 * SECOND), *press("a"), wait(8 * SECOND)]

# A a cada 0,4 s atravessa título, fala do Prof. Birch e escolha de gênero (padrão: garoto) e para
# no teclado de nome entre 190 e 200 s emulados. A partir daí A digita "!" e o jogo recusa o nome:
# o próximo roteiro precisa digitar um nome e confirmar (validacao-emulador/PRD-002, passo 1).
MASH_TO_NAME_ENTRY: list[Step] = [wait(12 * SECOND), *[step for _ in range(480) for step in press("a", 4, 20)]]

MOVIES: dict[str, list[Step]] = {
    "boot_to_title": BOOT_TO_TITLE,
    "mash_to_name_entry": MASH_TO_NAME_ENTRY,
}

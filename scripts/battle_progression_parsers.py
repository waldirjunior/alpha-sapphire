"""Parsers de evolução e natureza Gen 6 (ORAS) usados por extract_battle_tables.py."""

from __future__ import annotations

import struct

EVOLUTION_ENTRY_SIZE = 6
EVOLUTION_ENTRY_COUNT = 8
EVOLUTION_SET_SIZE = EVOLUTION_ENTRY_SIZE * EVOLUTION_ENTRY_COUNT

# Ordem dos ids de método da ROM (pk3DS EvolutionEditor6.evolutionMethods; índice 0 = vazio).
EVOLUTION_METHODS = (
    "none",
    "level_friendship",
    "level_friendship_morning",
    "level_friendship_night",
    "level",
    "trade",
    "trade_held_item",
    "trade_shelmet_karrablast",
    "use_item",
    "level_atk_gt_def",
    "level_atk_eq_def",
    "level_atk_lt_def",
    "level_personality_low",
    "level_personality_high",
    "level_ninjask",
    "level_shedinja",
    "level_beauty",
    "use_item_male",
    "use_item_female",
    "level_held_item_day",
    "level_held_item_night",
    "level_knows_move",
    "level_species_in_party",
    "level_male",
    "level_female",
    "level_magnetic_field",
    "level_mossy_rock",
    "level_icy_rock",
    "level_upside_down",
    "level_affection_move_type",
    "level_dark_type_in_party",
    "level_overworld_rain",
    "level_morning",
    "level_night",
    "level_female_set_form",
)
ITEM_METHODS = {"trade_held_item", "use_item", "use_item_male", "use_item_female", "level_held_item_day", "level_held_item_night"}

# Natureza n aumenta NATURE_STATS[n // 5] e diminui NATURE_STATS[n % 5]; n // 5 == n % 5 é neutra.
# Fonte: ordem canônica Gen III+ (Bulbapedia "Nature"), confirmada pelos nomes em a/0/7/3/0051.
NATURE_COUNT = 25
NATURE_STATS = ("atk", "def", "spe", "spa", "spd")


def method_name(method_id: int) -> str:
    if not 0 <= method_id < len(EVOLUTION_METHODS):
        raise ValueError(f"Método de evolução desconhecido: {method_id} (esperado 0..{len(EVOLUTION_METHODS) - 1})")
    return EVOLUTION_METHODS[method_id]


def parse_evolution_set(blob: bytes) -> list[dict[str, int | str]]:
    if len(blob) != EVOLUTION_SET_SIZE:
        raise ValueError(f"Conjunto de evolução com {len(blob)} bytes; esperado {EVOLUTION_SET_SIZE}")
    evolutions: list[dict[str, int | str]] = []
    for method, argument, species in struct.iter_unpack("<3H", blob):
        if method == 0:
            continue
        evolutions.append({"method": method_name(method), "argument": argument, "species": species})
    return evolutions


def annotate_evolution(evolution: dict[str, int | str], items: list[str], moves: list[str]) -> dict[str, int | str]:
    method, argument = evolution["method"], int(evolution["argument"])
    if method in ITEM_METHODS:
        return {**evolution, "itemName": items[argument]}
    if method == "level_knows_move":
        return {**evolution, "moveName": moves[argument]}
    return evolution


def build_natures(names: list[str]) -> list[dict[str, object]]:
    if len(names) < NATURE_COUNT:
        raise ValueError(f"Lista de naturezas com {len(names)} nomes; esperado {NATURE_COUNT}")
    natures: list[dict[str, object]] = []
    for index in range(NATURE_COUNT):
        increased, decreased = NATURE_STATS[index // 5], NATURE_STATS[index % 5]
        neutral = increased == decreased
        natures.append({
            "id": index,
            "name": names[index],
            "increased": None if neutral else increased,
            "decreased": None if neutral else decreased,
        })
    return natures

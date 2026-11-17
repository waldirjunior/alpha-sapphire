# Tabelas de batalha Gen 6 (ORAS)

Extraídas por [scripts/extract_battle_tables.py](../../../scripts/extract_battle_tables.py) para [src/data/battle/](../../../src/data/battle/). Layouts conferidos contra o pk3DS (`GARCReference_AO`, `PersonalInfoXY/ORAS`, `Move6`, `Learnset6`, `TypeChart6`, `TMHMEditor6`) e contra valores públicos conhecidos (ver Validação). Pendência relacionada: `P-010`. Lição: `A-010`.

## Geração

```bash
R=rom/extracted
for g in 1/8/9 1/9/1 1/9/5; do
  python3 scripts/unpack_garc.py --garc $R/RomFS/a/$g --out $R/garc/a_${g//\//_} --decompress
done
python3 scripts/extract_battle_tables.py --garc-root $R/garc --romfs $R/RomFS --exefs $R/ExeFS --out-dir src/data/battle
```

`a_0_7_3` (gametext EN) já precisa estar desempacotado. Todos os `.bin` ficam em `rom/` (ignorado pelo Git). Só são gravados números de mecânica e nomes curtos (espécie, golpe, tipo, habilidade); textos descritivos/flavor não são extraídos.

## Fontes e offsets

| Tabela | Origem | Formato |
|---|---|---|
| Personal | `a/1/9/5`, último arquivo (`0826.bin`, 66080 B) | 826 entradas × `0x50` (entradas `0000–0825` individuais têm o mesmo conteúdo) |
| Golpes | `a/1/8/9/0000.bin` | mini-pack `WD`: `u16 count` @2 + `(count+1)` `u32` offsets; 622 entradas × `0x22` |
| Level-up | `a/1/9/1/NNNN.bin` (826, um por índice personal) | pares `<hh>` (golpe, nível) terminados por `u32 0xFFFFFFFF` |
| Tipos | `RomFS/DllBattle.cro` @`0xDB428` | 18×18 `u8`, linha = atacante, coluna = defensor; `0/2/4/8` = ×0/×½/×1/×2 |
| TM/HM | `ExeFS/code.bin` (descomprimido), após assinatura `D4 00 AE 02 AF 02 B0 02` (achada em `0x4A67E6`, dados em `0x4A67EE`) | 107 `u16`: TM01–92, HM01–05, HM06, TM93–100, HM07 |
| Evolução | `a/1/9/2/NNNN.bin` (826, um por índice personal) | 8 × `<method u16, argument u16, species u16>` (48 B); `method` = índice em `EVOLUTION_METHODS` (`battle_progression_parsers.py`, ordem do pk3DS `EvolutionEditor6`), `argument` = nível, item, golpe, espécie ou tipo conforme o método |
| Naturezas | nomes em `a/0/7/3/0051`; modificadores pela regra canônica Gen III+ | natureza `n` aumenta `[atk,def,spe,spa,spd][n÷5]` e reduz `[...][n mod 5]` (Bulbapedia "Nature"); a ROM não traz a tabela de modificadores como dado |
| Nomes | `a/0/7/3` | `0014` golpes, `0018` tipos, `0037` habilidades, `0051` naturezas, `0098` espécies, `0114` itens |

### Personal (`0x50`)

| Offset | Campo |
|---|---|
| `0x00–0x05` | HP, ATK, DEF, **SPE**, SPA, SPD (velocidade vem antes dos especiais) |
| `0x06–0x07` | tipos 1/2 |
| `0x08` | catch rate · `0x09` estágio evolutivo |
| `0x0A` | `u16` EV yield, 2 bits por stat na mesma ordem acima |
| `0x0C–0x11` | 3 itens segurados (`u16`) |
| `0x12` | razão de gênero · `0x13` ciclos de ovo · `0x14` amizade base |
| `0x15` | curva de XP (0 medium fast, 1 erratic, 2 fluctuating, 3 medium slow, 4 fast, 5 slow) |
| `0x16–0x17` | grupos de ovo |
| `0x18–0x1A` | habilidades 1/2/oculta |
| `0x1C` | `u16` índice personal da 1ª forma alternativa · `0x20` número de formas |
| `0x22` | `u16` XP base · `0x24` altura (dm) · `0x26` peso (hg) |
| `0x28–0x37` | bitfield TM/HM: bits 0–99 = TM01–100, 100–106 = HM01–07 |
| `0x38–0x4F` | tutores (não extraídos) |

Formas: entradas `722+` pertencem à espécie cujo `formStatsIndex` aponta para elas (forma `n` = `formStatsIndex + n - 1`). Ex.: personal 722–724 = Deoxys formas 1–3; Mega Sceptile = espécie 254 forma 1.

### Golpe (`0x22`)

`0x00` tipo · `0x01` quality · `0x02` categoria (0 status, 1 físico, 2 especial) · `0x03` poder · `0x04` precisão (`101` = nunca erra) · `0x05` PP · `0x06` prioridade (`s8`) · `0x07` hits min/max (nibbles) · `0x08` `u16` inflict + `0x0A` chance + `0x0B` duração · `0x0C/0x0D` turnos min/max · `0x0E` estágio de crítico · `0x0F` flinch % · `0x10` `u16` effect sequence · `0x12` recoil/drain (`s8` %: >0 dreno, <0 recuo sobre o dano) · `0x13` healing (`s8` %: >0 cura do HP máx., <0 dano ao usuário — Struggle = `231` = −25) · `0x14` alvo · `0x15–0x1D` até 3 mudanças de stat (stat, estágio `s8`, chance) · `0x1E` `u32` flags.

## Saída (`src/data/battle/`)

Um registro por linha para diffs legíveis.

- `species.json` — 826 registros `{personalIndex, species, form, name, baseStats, types, abilities, growthRate, eggGroups, tms, hms, ...}`.
- `moves.json` — 622 golpes `{id, name, type, category, power, accuracy, pp, priority, ...}`.
- `types.json` — `{types[18], effectiveness[atacante][defensor]}`.
- `learnsets.json` — `[{personalIndex, levelUp: [{level, move}]}]`.
- `machines.json` — `{tmMoves[100], hmMoves[7]}` (IDs de golpe).
- `evolutions.json` — `[{personalIndex, evolutions: [{method, argument, species, itemName?, moveName?}]}]`.
- `natures.json` — 25 `{id, name, increased, decreased}`.

## Validação (oráculo Bulbapedia/pokemondb)

- Treecko (252): 40/45/35/70/65/55, Grass, Monster/Dragon, Overgrow/Unburden, Medium Slow; learnset Pound/Leer L1, Absorb L5, Quick Attack L9, Mega Drain L13, Pursuit L17.
- Mega Sceptile (254 forma 1): 70/110/75/145/145/85, Grass/Dragon, Lightning Rod. Primal/Mega Rayquaza (384 forma 1): Delta Stream, ATK/SPA 180.
- Tackle 50/100/35, Thunderbolt 90/100/15, Dragon Ascent 120/100/5.
- Fire→Grass ×2, Dragon→Fairy ×0, Electric→Ground ×0, Steel→Steel ×½.
- Treecko → Grovyle Lv.16; Eevee: Water/Thunder/Fire Stone, amizade de dia/noite, Moss/Ice Rock, Sylveon; Wurmple por personalidade.
- TM01 = Hone Claws, HM01–07 = Cut, Fly, Surf, Strength, Waterfall, Rock Smash, Dive.

Testes com fixtures sintéticas: `BattleTablesTest` em [scripts/test_pipeline.py](../../../scripts/test_pipeline.py).

## Fora do escopo

Egg moves (`a/1/9/0`), mega evoluções (`a/1/9/3`), tutores (`0x38–0x4F`) e itens (`a/1/9/7`). Consumo em `src/core/`: `typeChart.ts`, `dex.ts`, `learnsets.ts` e a simulação (`battleTurn.ts`, `moveExecution.ts`, `statusConditions.ts`; ver `A-011`/`A-012`). Efeitos ainda não simulados estão listados em `P-010`.

# Áudio ORAS: zona → BGM

Gerado por [scripts/extract_zone_audio.py](../../../scripts/extract_zone_audio.py) em [src/data/zone_audio.json](../../../src/data/zone_audio.json). Pendência: `P-008`. Lição: `A-023`. Só são gravados índices e identificadores técnicos (rótulo de som e nome de arquivo); nenhum áudio é versionado.

## Cadeia de resolução

```text
ZoneData[zona] u16 @0x08  ──►  code.bin tabela BGM[índice]  ──►  BCSAR som[n]  ──►  arquivo externo .bcstm  ──►  rom/extracted/audio/mp3/<nome>.mp3
   (índice BGM da zona)          (0x01000000 | n)                (STRM_BGM_*)       (bgm_sg_*.dspadpcm.bcstm)
```

| Etapa | Fonte | Formato |
|---|---|---|
| Índice BGM da zona | `rom/extracted/garc/a_0_1_3/0536.bin` (ZoneData, 536 × `0x38`) | `u16 @0x08`; `u16 @0x0A` é sempre `1`. pk3DS (XY) chama `0x08..0x17` de `BGMSpring/Summer/Autumn/Winter` (`u32`); no ORAS só `0x08` varia (`0x0C`, `0x10`, `0x14` são constantes `0x00010005`, `0x00010005`, `0x0001000E`) |
| Índice BGM → som | `ExeFS/code.bin`, logo após a string `rom:/sound/sango_sound.bcsar` (alinhado a 4; tabela em `0x4928DC` nesta ROM) | 216 × `u32` = `0x01000000 \| índiceDoSom` (tipo `0x01` = som no BCSAR); termina no primeiro valor sem tipo `0x01` |
| Som → rótulo/arquivo | `RomFS/sound/sango_sound.bcsar` | ver abaixo |

## BCSAR (`CSAR`, versão `0x02030100`)

- **Header:** `CSAR`, BOM `FFFE`, `u16` tamanho do header (`0x40`), `u32` versão, `u32` tamanho, `u16 @0x10` nº de seções; refs de seção em `0x14` (12 B: `u16 id`, pad, `u32 offset`, `u32 size`): `0x2000 STRG @0x40`, `0x2001 INFO @0x35240`, `0x2002 FILE @0x9BD40`.
- **Referência:** 8 B (`u16 tipo`, pad, `s32 offset`). **Tabela de referências:** `u32 count` + `count` refs com offset relativo ao início da tabela.
- **STRG:** após `STRG`+`u32 size`, ref `0x2400` → tabela de strings: `u32 count` (3190) + entradas de 12 B (`u16 0x1F01`, pad, `s32 offset`, `u32 size` com o `\0`), offsets relativos à tabela. Ref `0x2401` = árvore Patricia (não usada).
- **INFO:** após `INFO`+`u32 size`, 8 refs: `0x2100` sons, `0x2104` grupos de som, `0x2101` bancos, `0x2103` wave archives, `0x2105` grupos, `0x2102` players, `0x2106` arquivos, `0x220B` projeto.
- **Entrada de som** (tabela `0x2100`, 1709 sons): `u32 fileId @0`, `u32 playerId @4`, `u8 volume @8`, ref de detalhe `@12` (`0x2201` stream, `0x2202` wave, `0x2203` sequência), `u32 flags @20`; com `flags & 1`, `u32 stringId @24` indexa a STRG. Os 256 primeiros sons são streams (`STRM_BGM_*` 0–210, `STRM_ME_*` 211–255).
- **Entrada de arquivo** (tabela `0x2106`, 4518): ref `0x220D` = externo, seguida do nome `\0`-terminado (`bgm_sg_t_01.dspadpcm.bcstm`); `0x220C` = interno (no bloco FILE).

## Validação

| Zona | Nome | índice BGM | som | rótulo | arquivo |
|---|---|---|---|---|---|
| 6 | Littleroot Town | 5 | 19 | `STRM_BGM_T_01` | `bgm_sg_t_01` |
| 223 | Casa do jogador (Littleroot) | 5 | 19 | `STRM_BGM_T_01` | `bgm_sg_t_01` |
| 227 | Laboratório do Birch | 18 | 56 | `STRM_BGM_LABO` | `bgm_sg_labo` |
| 7 | Oldale Town | 6 | 20 | `STRM_BGM_T_02` | `bgm_sg_t_02` |
| 228 | Centro Pokémon de Oldale | 16 | 51 | `STRM_BGM_POKECEN` | `bgm_sg_pokecen` |
| 23–25 | Route 101–103 | 11 | 31 | `STRM_BGM_R_A` | `bgm_sg_r_a` |
| 26, 30 | Route 104, 107 | 12 | 32 | `STRM_BGM_R_B` | `bgm_sg_r_b` |

As 536 zonas resolvem para um `.mp3` existente. Zona 0 (cópia técnica de Littleroot) aponta para `STRM_BGM_TEST1` → `bgm_xy_silence`. Vários rótulos compartilham arquivo (ex.: todos os `STRM_BGM_VS_*` XY → `bgm_xy_vs_trainer_pss`; testes → silêncio). Índices BGM ≥ 256 na tabela do `code.bin` apontam para sons não-stream (fora do escopo).

## Saída

`src/data/zone_audio.json`: um registro por linha `{zone, name, bgmIndex, soundIndex, soundLabel, bgmName, hasMp3}`; `bgmName` é o nome do `.mp3` sem extensão.

## Fora do escopo

Música de batalha/encontro por treinador, variações por evento/flag de história (ex.: Littleroot após o intro), ME (`STRM_ME_*`), efeitos sonoros (SEQ/WSD no bloco FILE) e integração no `src/engine/` (`P-008`).

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

## Arquivos internos de SFX: CSEQ, CBNK, CWAR e CWAV

O parser [extract_bcsar_sfx.py](../../../scripts/extract_bcsar_sfx.py) percorre `INFO → 0x2100/0x2106 → FILE`, preservando os índices do archive. Para cada entrada `0x220A`, `0x220D` resolve para nome externo; `0x220C` aponta a um descritor interno de 12 B (`u16 tipo`, `u16 pad`, `s32 offset`, `u32 tamanho`). O payload fica em `FILE + 8 + offset`; o campo tipo varia entre entradas (foram observados `0` e `0x1F00`), portanto não é usado como assinatura do arquivo.

Na ROM local examinada, `0x2100` contém 1709 sons: 256 streams e 1453 sequências (`detail ref 0x2203`). A entrada mantém `fileId @0`, `playerId @4`, volume em `@8`, referência de detalhe em `@12`, flags em `@20` e `stringId @24`; quando `flags & 1`, o `stringId` seleciona o rótulo STRG. O `fileId` indexa diretamente `0x2106`.

| Assinatura | Quantidade encontrada pelo extrator | Saída | Observação |
|---|---:|---|---|
| `CSEQ` | 1436 | `file_NNNN.cseq` | Dados de sequência; precisam do sequenciador e dos instrumentos para virar o efeito audível. |
| `CBNK` | 1424 | `file_NNNN.cbnk` | Bancos/instrumentos. |
| `CWAR` | 1424 | `file_NNNN.cwar` | Arquivos de wave archive. |
| `CWAV` | 1586 | `file_NNNN_wave_NNN.cwav` | Samples extraídos do contêiner CWAR; não são o efeito composto do CSEQ. |

O extrator valida o `fileSize @0x0C` do CWAV aninhado antes de separar o sample. Os bytes ficam apenas no diretório local informado por `--out-dir`; `manifest.json` registra os arquivos extraídos, rótulos/índices das sequências e, com `--zone-scripts`, argumentos literais de `SEPlay` encontrados no disassembly JSON.

### Converter samples CWAV para WAV

[convert_bcsar_cwav.py](../../../scripts/convert_bcsar_cwav.py) usa `vgmstream-cli` para decodificar cada entrada `CWAV` do manifesto para PCM WAV. Os nomes preservam o `fileId` e o índice do sample, por exemplo `file_0001_wave_000.wav`; `conversion-manifest.json` registra origem e saída. Instale `vgmstream-cli` e rode:

```sh
python3 scripts/convert_bcsar_cwav.py \
  --input-dir rom/extracted/audio/bcsar_sfx \
  --out-dir rom/extracted/audio/bcsar_sfx/wav
```

Essa conversão torna cada sample reproduzível no navegador, mas não monta o efeito da sequência. CSEQ exige sequenciador, CBNK e CWAR; o `vgmstream-cli` disponível nesta sessão não lista `cseq` entre os formatos suportados. Não atribua um sample CWAV a uma sequência sem resolver as relações de instrumento e wave.

Comando reproduzível a partir da raiz do checkout, apontando `--bcsar` ao dump local da ROM:

```sh
python3 scripts/extract_bcsar_sfx.py \
  --bcsar rom/extracted/RomFS/sound/sango_sound.bcsar \
  --out-dir rom/extracted/audio/bcsar_sfx \
  --zone-scripts src/data/zone_scripts
```

### Rótulos relevantes e limites do mapeamento

Os números abaixo são índices na tabela `0x2100`, não valores literais aceitos por `SEPlay`:

| Uso pelo rótulo do BCSAR | Índice / rótulo | ID literal `SEPlay` observado |
|---|---|---|
| Texto/diálogo | `261 SEQ_SE_MESSAGE` | `0x00060000` (589 chamadas em 322 zonas; alias contextual já usado pelo host). |
| Seleção/confirmação de menu | `262 SEQ_SE_DECIDE1`, `265 SEQ_SE_SELECT1` | `0x00060061` (1 chamada no script da zona 227; relação ao índice BCSAR não provada). |
| Porta | `1481 SEQ_SE_KW_DOOROPEN`, `1480 SEQ_SE_KW_DOORCLOSE` | `0x000A001D` é candidato de efeito de campo (69 chamadas/39 zonas); a associação à porta não foi provada. |
| Cura | `343 SEQ_SE_RECOVERY`; jingle `211 STRM_ME_KAIFUKU` | Nenhum literal `SEPlay` foi ligado com segurança ao rótulo. O jingle é `ME`, não `SE`. |
| Hit | `413 SEQ_SE_FLD_WALL_HIT`; sons de batalha ficam entre `SEQ_SE_BT_*` | Não há rótulo único “battle hit”; os IDs de sequência de batalha não foram ligados aos eventos do host. |
| Captura | `270 SEQ_SE_CATCH`; jingle `215 STRM_ME_POKEGET` | Nenhum literal `SEPlay` foi ligado com segurança ao rótulo. O jingle é `ME`, não `SE`. |
| Warp | Não há rótulo `SEQ_SE_*WARP` | `0x000A00DD`, previamente anotado como warp, não aparece nos JSONs `zone_scripts` atuais; manter como não confirmado. |

O scan literal também encontra `0x000A001D` (69), `0x00060017` (17), `0x000A0000` (13) e outros valores de campo; não se deve tratar o valor de `SEPlay` como índice BCSAR sem resolver a codificação/runtime que conecta os dois espaços. `0x000A0240`, anotado anteriormente como hit, também não aparece no corpus atual. O extrator cataloga os IDs e os rótulos BCSAR em separado para preservar essa distinção.

Os `.cseq`, `.cbnk`, `.cwar` e `.cwav` crus não são reproduzíveis diretamente pelo navegador; a conversão CWAV acima gera WAVs de samples, não sequências compostas. `BgmPlayer.playSfx(cue, {index, label, url?})` pode tocar um WAV identificado por índice/rótulo BCSAR; sem `url`, procura `/assets/audio/sfx/bcsar_<índice>_<rótulo>.wav`. Se o arquivo faltar ou não decodificar, toca o padrão procedural do cue. O `url` explícito permite apontar para uma saída CWAV apenas quando a relação entre aquele sample e o efeito foi demonstrada.

Os aliases literais `SEPlay` em `resolveZoneSfx` continuam a selecionar cues procedurais. Eles não são convertidos em índices BCSAR: o índice e o rótulo precisam ser passados separadamente com evidência da relação. `SEQ_SE_MESSAGE`, `SEQ_SE_DECIDE1`, `SEQ_SE_SELECT1`, `SEQ_SE_CATCH`, `SEQ_SE_RECOVERY`, `SEQ_SE_FLD_WALL_HIT` e os rótulos de porta seguem catalogados, mas ainda não foram provados como alvos dos IDs literais `SEPlay` do slice.

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

## Batalha e jingles

[src/core/battleAudio.ts](../../../src/core/battleAudio.ts) escolhe a faixa pelo contexto da batalha; os nomes abaixo vêm dos rótulos/faixas do BCSAR ORAS:

| Situação | Rótulo | Arquivo |
|---|---|---|
| Selvagem | `STRM_BGM_VS_NORAPOKE_SG` (som 100) | `bgm_sg_vs_norapoke_sg` |
| Treinador | `STRM_BGM_VS_TRAINER_SG` (101) | `bgm_sg_vs_trainer_sg` |
| Líder de ginásio | `STRM_BGM_VS_GYMLEADER_SG` (102) | `bgm_sg_vs_gymleader_sg` |
| Rival | `STRM_BGM_VS_RIVAL_SG` (103) | `bgm_sg_vs_rival_sg` |
| Equipe Aqua/Magma | pendente de confirmação no BCSAR (`A-027`) | `bgm_sg_vs_aqua_magma` |
| Elite Four | `STRM_BGM_VS_SHITENNO_SG` | `bgm_sg_vs_shitenno_sg` |
| Campeão | `STRM_BGM_VS_CHAMP_SG` | `bgm_sg_vs_champ_sg` |
| Pokémon lendário | `STRM_BGM_VS_LEGEND_SG` | `bgm_sg_vs_legend_sg` |
| Vitória selvagem / treinador / ginásio | `STRM_BGM_WIN1/2/3` (125–127) | `bgm_sg_win1/2/3` — **inferência** pela ordem dos rótulos (`A-027`) |
| Cura | `STRM_ME_KAIFUKU` (211) | `me_xy_kaifuku` |
| Level-up | `STRM_ME_LVUP` (212) | `me_xy_lvup` |

O contexto explícito (`BattleMusicSource.context`) prevalece; na ausência dele, `battleAudio.ts` classifica batalhas pelos nomes do treinador. O tema começa ao abrir a batalha, a fanfarra substitui o tema quando `status = victory` e a BGM da zona volta ao fechar a batalha (ou de imediato em fuga/captura/derrota). Jingles tocam uma vez com a BGM abaixada (`BgmPlayer.playJingle`). O slider e o mute do PokéNav persistem em `localStorage` e controlam o ganho master do Web Audio.

## Fora do escopo

IDs de BGM selecionados por `trdata`, variações por evento/flag de história (ex.: Littleroot após o intro), ME (`STRM_ME_*`) e efeitos sonoros (SEQ/WSD no bloco FILE) permanecem fora do escopo desta etapa (`P-008`).

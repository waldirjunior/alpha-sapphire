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

[convert_bcsar_cwav.py](../../../scripts/convert_bcsar_cwav.py) usa `vgmstream-cli` para decodificar entradas `CWAV` do manifesto para PCM WAV. Por padrão, os nomes preservam `fileId` e índice do sample, por exemplo `file_0001_wave_000.wav`; `--asset SOURCE=OUTPUT.wav` seleciona um sample e permite nomeá-lo pelo índice/rótulo BCSAR. `conversion-manifest.json` registra origem e saída. O conversor apresenta os bytes como `.bcwav` temporário, pois o binário local rejeitou a extensão `.cwav`, e usa `-i` para não repetir o loop do sample. Instale `vgmstream-cli` e rode:

```sh
python3 scripts/convert_bcsar_cwav.py \
  --input-dir rom/extracted/audio/bcsar_sfx \
  --out-dir rom/extracted/audio/bcsar_sfx/wav
```

No BCSAR local, a cadeia do `CSEQ` do som segue a tabela de bancos por item ID (`0x03`), e o `CBNK` aponta para o wave archive (`0x05`). O wave archive abaixo tem um único `CWAV` extraído; o arquivo WAV local é só esse sample, não a sequência composta:

| Som | `CSEQ` fileId | Bank item ID → `CBNK` fileId | Wave item ID → `CWAR` fileId | WAV local |
|---|---:|---|---|---|
| `261 SEQ_SE_MESSAGE` | 203 | `0x03000005` → 1640 | `0x05000011` → 3111 | `bcsar_261_SEQ_SE_MESSAGE.wav` |
| `262 SEQ_SE_DECIDE1` | 204 | `0x03000007` → 1642 | `0x05000013` → 3113 | `bcsar_262_SEQ_SE_DECIDE1.wav` |
| `265 SEQ_SE_SELECT1` | 207 | `0x0300000C` → 1647 | `0x05000018` → 3118 | `bcsar_265_SEQ_SE_SELECT1.wav` |
| `270 SEQ_SE_CATCH` | 212 | `0x03000012` → 1653 | `0x0500001E` → 3124 | `bcsar_270_SEQ_SE_CATCH.wav` |
| `343 SEQ_SE_RECOVERY` | 285 | `0x03000051` → 1716 | `0x0500005D` → 3187 | `bcsar_343_SEQ_SE_RECOVERY.wav` |
| `413 SEQ_SE_FLD_WALL_HIT` | 353 | `0x03000099` → 1788 | `0x050000A5` → 3259 | `bcsar_413_SEQ_SE_FLD_WALL_HIT.wav` |
| `1480 SEQ_SE_KW_DOORCLOSE` | 1417 | `0x030004AC` → 2831 | `0x050004B8` → 4302 | `bcsar_1480_SEQ_SE_KW_DOORCLOSE.wav` |
| `1481 SEQ_SE_KW_DOOROPEN` | 1418 | `0x030004AD` → 2832 | `0x050004B9` → 4303 | `bcsar_1481_SEQ_SE_KW_DOOROPEN.wav` |

A associação anterior de `343` a `file_3109_wave_000.cwav` estava errada: esse é o wave archive 15, mas o `CSEQ file_0285.cseq` aponta ao banco de índice 81 (`file_1716.cbnk`) e ao archive 93 (`fileId=3187`). O WAV correto de `343` foi convertido novamente. Os oito samples convertidos são PCM mono a 32728 Hz; duram de 0,130 s (`270`) a 0,920 s (`343`).

O `vgmstream-cli` local (r2168) lista `CWAV`, não `CSEQ`; a tentativa `vgmstream-cli -m file_0203.cseq` retorna `failed opening`. Não há sequenciador CSEQ instalado neste worktree, então a composição ficou bloqueada nesta sessão. A reprodução web procura `/assets/audio/sfx/bcsar_<índice>_<rótulo>.wav`; quando o WAV está ausente ou não decodifica, toca o padrão procedural do cue. CWAV é sample do banco, não uma gravação fiel da sequência nem prova de que o instrumento/nota selecionado usa aquele sample.

### Exportar e verificar os CWAVs referenciados por `SEPlay`

O comando abaixo exporta o lookup literal comprovado para `seplay_map.json`,
resolve as referências CSEQ → CBNK → CWAR → CWAV, converte os quatro alvos
prioritários e os caminhos CWAV únicos para `public/assets/audio/sfx/`, e grava
em `seplay_samples.json` somente os samples com WAV audível e cadeia única.
Os WAVs permanecem no checkout principal e são ignorados pelo Git.

```sh
python3 scripts/inspect_audio_dispatch.py \
  --rom-root rom/extracted \
  --seplay-map src/data/audio/seplay_map.json
python3 scripts/convert_bcsar_cwav.py \
  --input-dir rom/extracted/audio/bcsar_sfx \
  --out-dir public/assets/audio/sfx \
  --bcsar rom/extracted/RomFS/sound/sango_sound.bcsar \
  --seplay-map src/data/audio/seplay_map.json \
  --catalog-out src/data/audio/seplay_samples.json
```

No dump local, os 72 literais resolvem para índices/labels BCSAR. O conversor
encontra dois caminhos CWAV únicos (`0x000A0121` → `669 SEQ_SE_FLD_210` e
`0x000A0130` → `684 SEQ_SE_FLD_225`) e 70 literais ambíguos. Os quatro alvos
prioritários têm dois CWAVs candidatos cada; seus oito samples foram decodificados
com pico PCM não zero, mas não foram associados ao playback literal. A lista
completa, incluindo cada literal e seus arquivos candidatos, está em
[audio-dispatch-probe.md](audio-dispatch-probe.md#cadeias-cseq-e-amostras-cwav).
O relatório local `seplay-cwav-manifest.json` registra as tentativas e falhas de
decoder. O host permanece silencioso para sequências ambíguas e não toca cue
procedural para elas; cues semânticos comprovados ainda usam o fallback deles.

Comando reproduzível a partir da raiz do checkout, apontando `--bcsar` ao dump local da ROM:

```sh
python3 scripts/extract_bcsar_sfx.py \
  --bcsar rom/extracted/RomFS/sound/sango_sound.bcsar \
  --out-dir rom/extracted/audio/bcsar_sfx \
  --zone-scripts src/data/zone_scripts
```

### Rótulos relevantes e limites do mapeamento

Os números abaixo são índices na tabela `0x2100`, não valores literais aceitos por `SEPlay`. O wrapper ARM, a regra de dispatch e os 72 mapeamentos literais agora estão provados em [audio-dispatch-probe.md](audio-dispatch-probe.md):

| Uso pelo rótulo do BCSAR | Índice / rótulo | ID literal `SEPlay` observado |
|---|---|---|
| Mensagem | `261 SEQ_SE_MESSAGE` | `0x00060000` → som BCSAR 261 (589 chamadas). |
| Efeito de sistema | `284 SEQ_SE_SYS_006`, `358 SEQ_SE_SYS_066` | `0x00060017`, `0x00060061`; veja a tabela completa na probe. |
| Cura | `343 SEQ_SE_RECOVERY`; jingle `211 STRM_ME_KAIFUKU` | Nenhum literal `SEPlay` foi ligado com segurança ao rótulo. O jingle é `ME`, não `SE`. |
| Hit | `413 SEQ_SE_FLD_WALL_HIT`; sons de batalha ficam entre `SEQ_SE_BT_*` | Não há rótulo único “battle hit”; os IDs de sequência de batalha não foram ligados aos eventos do host. |
| Captura | `270 SEQ_SE_CATCH`; jingle `215 STRM_ME_POKEGET` | Nenhum literal `SEPlay` foi ligado com segurança ao rótulo. O jingle é `ME`, não `SE`. |
| Outros efeitos | Rótulos conforme dispatch | Todos os 72 literais do corpus resolvem numericamente para BCSAR/STRG; associação ao cue semântico do host continua separada. |

O decoder de `code.bin` usa os bits 16–23 como grupo e os bits 0–15 como índice local; consulta a tabela de grupo e retorna o ID BCSAR codificado. Por isso `0x00060061` resolve para `358 SEQ_SE_SYS_066`, não para `262` ou `265`; `0x000A001D` também tem um alvo exato, sem que isso prove que seja uma porta. `0x000A0240` não pertence ao corpus atual. O relatório lista o alvo BCSAR de cada literal e mantém sua semântica de jogo em aberto.

Os `.cseq`, `.cbnk`, `.cwar` e `.cwav` crus não são reproduzíveis diretamente pelo navegador; a conversão CWAV acima gera WAVs de samples, não sequências compostas. `battleAudio.ts` mantém uma tabela separada de referências nativas para cues do host. Só `0x00060000` continua ligado a `dialogue-confirm`; os aliases `0x00060061`, `0x000A001D` e `0x000A0240` foram removidos porque suas associações semânticas anteriores não eram sustentadas. `SceneManager.playSfx` passa referências ao `BgmPlayer`; se o WAV faltar ou não decodificar, o cue mantém o fallback procedural. Os oito WAVs deste slice ficam em `public/assets/audio/sfx/`, ignorado pelo Git.

O mapa numérico `SEPlay → BCSAR` já está resolvido. Associar cada alvo a um cue de domínio, tocar as sequências compostas e identificar os WAVs de todos os alvos seguem fora da evidência desta etapa de `P-008`.

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
| Equipe Aqua / Magma | `STRM_BGM_VS_AQUA` (104) / `STRM_BGM_VS_MAGMA` (105) | `bgm_sg_vs_aqua_magma` (arquivo compartilhado) |
| Elite Four | `STRM_BGM_VS_SHITENNO_SG` | `bgm_sg_vs_shitenno_sg` |
| Campeão | `STRM_BGM_VS_CHAMP_SG` | `bgm_sg_vs_champ_sg` |
| Pokémon lendário | `STRM_BGM_VS_LEGEND_SG` | `bgm_sg_vs_legend_sg` |
| Vitória | `STRM_BGM_WIN1/2/3` (125–127) | `bgm_sg_win1/2/3`; associação a tipo/resultado não provada pela ROM inspecionada |
| Cura | `STRM_ME_KAIFUKU` (211) | `me_xy_kaifuku` |
| Level-up | `STRM_ME_LVUP` (212) | `me_xy_lvup` |

O contexto explícito (`BattleMusicSource.context`) prevalece; na ausência dele, `battleAudio.ts` classifica batalhas pelos nomes do treinador. O tema começa ao abrir a batalha, a fanfarra substitui o tema quando `status = victory` e a BGM da zona volta ao fechar a batalha (ou de imediato em fuga/captura/derrota). Jingles tocam uma vez com a BGM abaixada (`BgmPlayer.playJingle`). O slider e o mute do PokéNav persistem em `localStorage` e controlam o ganho master do Web Audio.

## Fora do escopo

O campo de classe em `trclass @0x0C` e seus valores BCSAR estão catalogados em [audio-dispatch-probe.md](audio-dispatch-probe.md), mas a seleção desse valor em todos os fluxos de batalha não foi provada. Também permanecem fora do escopo as variações por evento/flag de história (ex.: Littleroot após o intro), a associação de `WIN1/2/3` ao resultado e os efeitos compostos de SEQ/WSD no bloco FILE (`P-008`).

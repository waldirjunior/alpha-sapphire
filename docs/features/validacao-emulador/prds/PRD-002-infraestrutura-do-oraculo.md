# PRD-002 — Infraestrutura do oráculo: emulador dirigido por script

- **Módulo:** [validacao-emulador](../README.md)
- **Estado:** Entregue (passos 1 a 5 concluídos; perguntas de movimento seguem no item 7 da fila / PRD-015)
- **Data:** 2026-11-18
- **ADRs relacionados:** [ADR-001](../adrs/ADR-001-oraculo-emulador-e-tabelas-abertas.md)
- **Pendência:** P-021

## 1. Problema

O emulador é o oráculo do projeto desde a ADR-001, mas nunca havia sido instalado nem automatizado. Sem ele, toda dúvida sobre câmera, oclusão e permissão de movimento virou sessão de disassembly sem mudança de runtime, e nenhum aceite visual comparou o port com o original.

## 2. Objetivo

Responder por script, sem interação humana: como o original aparece em um ponto do mapa e para onde o jogador vai quando recebe uma sequência de botões.

## 3. Entregue (2026-11-18)

- Azahar 2126.2 com perfil isolado em `rom/emulator/`; `python3 -m scripts.azahar_oracle init|check|play`.
- Cliente RPC próprio (`scripts/azahar_rpc.py`): leitura e escrita de memória do processo do jogo e captura de frame em PNG.
- Gerador de filme de entrada (`scripts/azahar_movie.py`): botões e toque, determinístico desde o boot.
- Roteiros `boot_to_title`, `mash_to_name_entry`, `intro_to_first_save` (digita `"a"`, confirma, sai do caminhão, entra em casa e salva no 1F) e `continue_game` (~21 s emulados até controle livre do jogador) em `scripts/azahar_movies.py`.
- Editor e inspetor de saves (`scripts/oras_save.py`): lê/valida todos os 58 blocos da tabela `0x42454546` (`"BEEF"`, offset `0x75E10`, entradas `<IHH` a partir de `0x75E14`, blocos alinhados a `0x200` com `CRC-16/CCITT-FALSE`), atualiza `BLK 4` (`Situation` em `0x01400`: slots `+0x002/+0x010` e `+0x0F4/+0x104` em unidades de mundo `(originTile + tile + 0,5) × 18`) e `BLK 10` (`Overworld Actors` em `0x02000`, `32 × 0x108` bytes: move o ator do jogador `eid=0x00FF` para o slot 0 e limpa slots estaleados ao mudar de zona), recalculando os dois CRCs.
- 18 testes unitários de emulação (`scripts/test_azahar_oracle.py`) + 6 testes unitários de save (`scripts/test_oras_save.py`), sem emulador.
- Tutorial de instalação: [setup-emulador.md](../setup-emulador.md).
- Suporte e validação em Linux headless (Ubuntu 24.04 `x86_64` com `xvfb-run` e Mesa `llvmpipe`: `init` em 16,8 s e `check` em 56 s), com controle de grupo de processos (`EmulatorProcess`), detecção de instância ativa pela porta UDP 45987 (`rpc_port_in_use`), resolução automática de `squashfs-root/AppRun` e timeout configurável via `ALPHA_EMULATOR_BOOT_TIMEOUT`.

Evidência observada: `check` inicia o jogo (processo `sango-2`, título `000400000011C500`), lê `0x00100000` e salva um frame do vídeo de abertura; `intro_to_first_save` conclui o save no 1F em `save_path()`; `continue_game` carrega o save existente em ~21 s emulados (`12,5 s` parede a `--speed 400`); a partir do save externo pós-relógio/TV em `zone 6`, `oras_save relocate` coloca Brendan exatamente no ponto pedido tanto em mapa externo (`--zone 6 --x 17 --z 14 --y 2.0`, `--zone 7 --x 18 --z 5` Oldale Town) quanto interno (`--zone 227 --x 14 --z 12` Laboratório do Prof. Birch).

## 4. Fila de continuação

Cada passo é uma sessão curta. Faça em ordem; a verificação diz quando acabou.

| # | Resultado | Como | Verificação |
| --- | --- | --- | --- |
| 1 | *(Concluído)* Roteiros `intro_to_first_save` e `continue_game`. | `scripts/azahar_movies.py`: `175` `A` rápidos + `5` espaçados (`wait(150)`) + `2 × Delete` (`tap(264, 72)`) + `'a'` (`tap(55, 148)`) + `Enter` (`tap(259, 110)`), caminhão e menu `X` → Save. | Confirmado por `continue_game --at 50 --speed 400` carregando no jogo em ~21 s emulados. |
| 2 | *(Concluído)* `scripts/oras_save.py`: leitura e relocalização de saves `main` (`0x76000`). | Tabela `0x42454546` em `0x75E10`, 58 blocos `<IHH` em `0x75E14`, `BLK 4` (`Situation`) + `BLK 10` (`Overworld Actors`), `groundHeights * 18` via `src/data/maps_v2/<zone>.json`. | `scripts/test_oras_save.py` (6 testes) e cargas verificadas no Azahar em `zone 6 (17, 14)`, `zone 7 (18, 5)` e `zone 227 (14, 12)`. |
| 3 | *(Concluído)* 25 capturas de referência, uma por cenário de `src/visual/scenarios.ts`, em `rom/visual-reference/<id>.png`. | `crop_top_screen_png`, `load_visual_scenarios` e `capture-references` em `scripts/azahar_oracle.py`; comparação lado a lado em `src/visual/gallery.ts` e `e2e/visual.spec.ts`. | 25 recortes 400×240 gerados e inspecionados; `npm run test:e2e` (30/30) monta `rom/visual-report/index.html` com 25 cartões `.compare` e diferenças anotadas em [PRD-001](../../validacao-visual/prds/PRD-001-regressao-visual-e-smoke.md). |
| 4 | *(Concluído)* Endereço da posição viva do jogador na memória (`player_world_position` e `player_cell`). | Varredura RAM via RPC + confirmação em `zone 6` e `zone 7`: `PLAYER_ZONE_ADDR = 0x08187BD4` (`u32`) e `PLAYER_WORLD_POS_ADDR = 0x08187BF4` (`<fff`). | `LiveMemoryPositionTest` em `scripts/test_azahar_oracle.py`; após caminhar e salvar em Littleroot (`X -> Save`), `player_cell(rpc)` retorna `(15, 14)`, idêntico a `oras_save inspect`. |
| 5 | *(Concluído)* Teste diferencial de movimento em Littleroot (`zone 6`). | Roteiro D-pad (`14` frames CTM/passo a 100%) amostrado a 25 Hz via `player_world_position` (`compress_cell_trace`) gravado em `src/ai/traces/littleroot_movement.json` e testado em `src/ai/emulatorParity.test.ts`. | 11 células distintas `(17,14)→(17,12)` + colisão `(17,11)` passam 100% em `movePlayer`; primeira divergência documentada em `(20,15)` (`zone_0006:npc:6`, `spawnFlag=612`). |
| 6 | *(Item da fila PRD-015)* Ledges laterais, Surf e bike respondidos por observação. | Usar o oráculo agora entregue sobre os trechos correspondentes da ROM. | Executado no item dedicado da fila em [ROADMAP](../../../ROADMAP.md). |

### Dicas para o passo 1

- A captura tem 400×480: tela de cima em `y 0–240`; tela de baixo (320×240) em `x 40–360, y 240–480`. Coordenada de toque = `(x − 40, y − 240)` da captura.
- No teclado de nome (veja `rom/emulator/frames/mash_to_name_entry-00.png` após `play mash_to_name_entry --at 205 --speed 400`): tecla `a` ≈ `tap(48, 145)`, Enter ≈ `tap(260, 110)`, Delete ≈ `tap(265, 75)`.
- `MASH_TO_NAME_ENTRY` continua apertando A depois que o teclado abre e digita `!`. O roteiro novo deve parar de apertar A por volta de 188 s emulados, esperar o teclado e só então tocar nas teclas.
- Trabalhe a 400% e capture a cada 5–10 s até localizar cada tela; depois fixe os tempos.

## 5. Limites conhecidos

- Em Linux sem GPU (Mesa `llvmpipe`), o boot até o primeiro frame leva ~55 s; use `ALPHA_EMULATOR_BOOT_TIMEOUT=300` e `xvfb-run -a`.
- Uma sessão do emulador por vez (porta RPC fixa).
- O instante de captura é estimado por tempo de parede; a entrada é exata.
- Estado de história do save editado é o de início de jogo: serve para câmera, escala, terreno e movimento, não para NPCs que dependem de progresso.

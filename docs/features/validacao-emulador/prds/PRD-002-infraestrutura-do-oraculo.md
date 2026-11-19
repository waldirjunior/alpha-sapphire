# PRD-002 — Infraestrutura do oráculo: emulador dirigido por script

- **Módulo:** [validacao-emulador](../README.md)
- **Estado:** Base entregue; captura de referência e teste diferencial em aberto
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
| 3 | 25 capturas de referência, uma por cenário de `src/visual/scenarios.ts`, em `rom/visual-reference/<id>.png`. | Para cada cenário: editar o save (passo 2), `continue_game`, capturar. O frame traz as duas telas; a de cima é o recorte 400×240 superior. | Galeria `rom/visual-report/index.html` mostra port e original lado a lado; diferenças de câmera, escala e cor anotadas por cenário no PRD de validacao-visual. |
| 4 | Endereço da posição viva do jogador na memória. | Com o jogador em célula conhecida, varrer o heap pelo padrão de floats (x·18, y, z·18) com `rpc.read`, andar um passo por filme e repetir até sobrar um endereço. | Função `player_cell(rpc)` devolve a mesma célula que o save após salvar. |
| 5 | Teste diferencial de movimento: mesma sequência de D-pad no emulador e no core, comparando a célula a cada passo. | Roteiro `continue_game` + passos; amostrar `player_cell` em alta frequência e registrar a sequência de células distintas; gravar o traço em JSON versionado (números, não assets) e comparar em um teste Vitest em `src/ai/` contra `movePlayer`. | Teste verde para Littleroot; primeiro caso divergente registrado como pendência com o traço. |
| 6 | Ledges laterais, Surf e bike respondidos por observação (itens 9 e 10 da fila do ROADMAP). | Teleportar ao ponto em dúvida e reproduzir a entrada. | Regra implementada no core com teste e traço do emulador como evidência. |

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

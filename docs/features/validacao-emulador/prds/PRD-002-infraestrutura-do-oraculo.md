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
- Roteiros `boot_to_title` e `mash_to_name_entry` (`scripts/azahar_movies.py`).
- 18 testes unitários das partes puras (`scripts/test_azahar_oracle.py`), sem emulador.
- Tutorial de instalação: [setup-emulador.md](../setup-emulador.md).
- Suporte e validação em Linux headless (Ubuntu 24.04 `x86_64` com `xvfb-run` e Mesa `llvmpipe`: `init` em 16,8 s e `check` em 56 s), com controle de grupo de processos (`EmulatorProcess`), detecção de instância ativa pela porta UDP 45987 (`rpc_port_in_use`), resolução automática de `squashfs-root/AppRun` e timeout configurável via `ALPHA_EMULATOR_BOOT_TIMEOUT`.

Evidência observada: `check` inicia o jogo (processo `sango-2`, título `000400000011C500`), lê `0x00100000` e salva um frame do vídeo de abertura; `mash_to_name_entry` a 400% atravessa título, fala do Prof. Birch e escolha de gênero e chega ao teclado de nome aos ~190 s emulados.

## 4. Fila de continuação

Cada passo é uma sessão curta. Faça em ordem; a verificação diz quando acabou.

| # | Resultado | Como | Verificação |
| --- | --- | --- | --- |
| 1 | Roteiro `intro_to_first_save`: digita um nome, confirma, sai do caminhão, entra em casa e salva pelo menu. | Estender `MASH_TO_NAME_ENTRY`. No teclado de nome, usar `tap(x, y)` nas teclas da tela de baixo (320×240) e no botão de confirmar; depois continuar com A e D-pad, capturando frames para achar cada tela. Menu: X, escolher Save, confirmar. | Existe `rom/emulator/data/azahar-emu/sdmc/…/title/00040000/0011c500/data/00000001/main` (`save_path()` em `azahar_session.py`) e um roteiro `continue_game` chega ao controle do jogador em menos de 30 s emulados. |
| 2 | `scripts/oras_save.py`: lê e grava zona e posição do jogador no save, recalculando o checksum do bloco. | Salvar duas vezes em posições diferentes e comparar os arquivos para achar o bloco. Hipótese a confirmar, vinda do PKHeX: save de 0x76000 bytes, tabela de blocos no fim com `{u32 tamanho, u16 id, u16 CRC16-CCITT}`, bloco de situação com zona em u16 e X/Z/Y em float divididos por 18. Validar recalculando os checksums do save real antes de editar. | Teste unitário com fixture sintética; no emulador, `continue_game` após editar o save abre na zona e célula pedidas. |
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

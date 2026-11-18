# ADR-005 — ABI por CRO e init não bloqueante

- **Estado:** aceito no recorte conservador de P-013.
- **Data:** 2026-11-17.
- **Referências:** ADR-003, ADR-004 e PRD-004 deste módulo.

## Contexto

O init de Littleroot interrompia em `BuildMdlGetHandleByGPos`. Diagnósticos
apresentados como diálogo bloqueavam o teclado. Além disso, projetar o ator
255 durante init de spawn/borda sobrescrevia a chegada calculada pelo core.
Esta decisão atualiza a apresentação dos diagnósticos de ADR-004; não declara
implementadas animações, câmera ou história completa.

## Evidência estática

A análise somente leu binários locais. O MCP Craft Anything estava indisponível;
foram usados o parser reproduzível `scripts/cro_native_abi.py` e Capstone 5.0.3
em `/tmp/events-abi-venv`, sem dependência nova do projeto ou execução da ROM.

Fonte: `DllField.cro`, SHA-256
`9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925`.
Os endereços abaixo são offsets de arquivo, não endereços virtuais. O parser
segue relocations internas do CRO: cada entrada da tabela nativa contém o
ponteiro de nome e, quatro bytes depois, o ponteiro da função. O manifesto
`src/data/zone_scripts/host-abi.json` registra esses offsets e o SHA.
Para repetir a inspeção em um ambiente com Capstone 5.0.3:

```bash
python3 -m scripts.cro_native_abi \
  "$CHECKOUT/rom/extracted/RomFS/DllField.cro" \
  BuildMdlGetHandleByGPos MsgLoad _MapChangeCore --bytes 0x230
```

| Nativa | Wrapper | Evidência e interpretação |
| --- | --- | --- |
| `BuildMdlGetHandleByGPos` | `0x50718` | `ldrd r0,r1,[r1,#4]`; `add r0,r1,r0,lsl #16`; `bx lr`. Retorna `(x << 16) + z` com wrap signed-32; não consulta a cena. |
| `MsgLoad` | `0x5cf60` | Primeiro argumento booleano escolhe as tabelas por idioma; segundo passa pelo switch de 25 seletores em `0x5cff4`, após limite em `0x5cfe4`. Não é índice direto de arquivo. |
| `MsgIsLoaded` | `0x5202c` | Ignora a célula recebida e consulta o slot atual. A aridade continua 1 porque os scripts efetivamente passam uma célula. |
| `MsgSwap` / `MsgRelease` | `0x5d1bc` / `0x51be0` | Troca slots `0x88/0x8c` ou libera o slot atual, respectivamente. |
| `_MapChangeCore` | `0x54aa4` | Zona uint16, x, altura, z, direção byte, quatro booleanos; x/z multiplicados por 18, altura convertida sem essa escala. Retorno 0 em `0x54b9c`. Não recebe warpId. |

As tabelas por idioma ficam em `code.bin` (SHA-256
`b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16`),
base virtual `0x100000`. A tabela `0x58b94c` contém 71–78; a `0x58b96c`,
79–86. Na entrada inglesa 2, os IDs são 73 (`a/0/7/3`, GameText) e 81
(`a/0/8/1`, StoryText). Assim, `MsgLoad(0, selector)` usa GameText;
primeiro argumento não zero usa StoryText. O manifesto contém os 25 seletores;
17 permanece inválido, e 14/19 apontam ao mesmo arquivo 134.

`TalkMdlMsg_Seq`, wrapper `0x54260`, consulta em `0x54320–0x54328` a célula
17 para escolher o banco auxiliar carregado; zero mantém o texto da zona.
O adaptador conserva slots atual/reservado e erros de recurso ausente. Não
substitui texto ausente por fala genérica nem presume sucesso de um load.

## Decisão de execução

1. Implementar o handle empacotado como nativa pura, com testes de overflow.
2. Manter texto, tecla, frames e transição como efeitos do engine. O core não
   importa DOM, rede ou Three.js.
3. Suspender efeitos opacos com `pendingEffect` e diagnóstico no console, sem
   criar `activeDialogue`. `busy` é falso durante essa suspensão; setas ficam
   disponíveis. Consultas sem retorno validado mantêm `canAdvance=false`.
4. Conservar somente os stubs cosméticos aprovados: Enter fornece retorno 0,
   exceto `MdlAcmdUpdate=1`. `BuildMdlEventAnimeSetEnd` entra nessa lista de
   apresentação pendente, não como animação implementada. O log identifica
   claramente o retorno manual. Não há conclusão automática de efeito opaco.
5. Permitir NPC enquanto o init está opaco: guardar a continuação do init,
   executar a interação e restaurar a continuação com o mundo mais recente,
   preservando flags alteradas pelo NPC. Nova zona/reset descarta a continuação
   antiga. Texto/tecla reais continuam bloqueantes.
6. Projetar NPCs normalmente. Projetar player apenas em entrada por warp/script
   ou interação explícita; spawn e borda conservam posição/direção do core.
7. Classificar borda pela ligação que corresponde ao passo e destino, antes do
   commit do novo estado. O portal 7→24 é simultaneamente warp ROM e borda
   inferida: a existência de `stepWarp` não autoriza init a mover o player.
8. Separar `romOrigin` de `worldOrigin`: a primeira converte coordenadas AMX em
   tiles locais; a segunda posiciona chunks/câmera no corredor contínuo.
9. Carregar o destino de `_MapChangeCore` antes do commit, com guarda de geração,
   converter a posição pela origem ROM e inicializar a nova zona sem reprojetar
   atores antigos. Altura e quatro flags são conservados e diagnosticados;
   o engine ainda usa solo e fade genérico, sem paridade cinematográfica.

## Recursos locais e reprodução

Novos bancos StoryText e imagens AMX ficam somente em `public/assets/` ignorado.
Os 19 registros legados de opening-memory não são ampliados no Git. O loader
combina essas imagens com o manifesto incremental, somente para zona atual e
novos globais registrados. Assets ausentes, JSON inválido ou SHA divergente
produzem erro explícito; nenhum programa recebe memória zerada por fallback.
Fetches compartilham promessa em voo/cache e removem falhas para permitir retry.

Execute no worktree, apontando `CHECKOUT` ao checkout com a extração local.
Confirme o ignore **no checkout de saída** antes de gerar:

```bash
git -C "$CHECKOUT" check-ignore -v public/assets/texts/story/0260.json
git -C "$CHECKOUT" check-ignore -v public/assets/native/amx/zone_0007_entities.json
python3 -m scripts.extract_event_texts \
  --cro "$CHECKOUT/rom/extracted/RomFS/DllField.cro" \
  --story-root "$CHECKOUT/rom/extracted/garc/a_0_8_1" \
  --out "$CHECKOUT/public/assets/texts/story" \
  --manifest src/data/zone_scripts/host-abi.json
python3 -m scripts.extract_event_memory \
  --rom-root "$CHECKOUT/rom/extracted" --zone 7 --zone 24 \
  --out "$CHECKOUT/public/assets/native/amx" \
  --manifest src/data/zone_scripts/local-memory.json
```

Resultado verificado: 23 arquivos StoryText auxiliares e quatro imagens AMX
adicionais (entities/map de 7/24), totalizando 23 imagens disponíveis localmente.
Os dois manifestos versionados contêm somente identidades, offsets e SHA, não
textos ou células adicionais da ROM. Em outro deployment, gere os assets no
`public/` efetivamente servido. O build não embute esses novos recursos privados.

## Verificação e limites

- `npm test && npm run build`: 195 testes/35 arquivos e build passando;
  mantém aviso herdado de chunks >500 kB.
- `python3 -m unittest scripts.test_cro_native_abi scripts.test_event_memory`:
  seis testes sintéticos passando, sem binários da ROM.
- Chromium visível em 5178, código do worktree e `public/` principal: NPC real
  de Littleroot/script 14 exibiu texto ROM após cinco confirmações cosméticas,
  sem avançar o init opaco para conseguir interagir.
- Travessia real 7→24 conservou `(79,20)/right`; a seta seguinte levou a
  `(78,20)/left`, sem diálogo de diagnóstico. Assets novos das duas zonas foram
  carregados. O teste aguarda promessas de programas/texto: `networkidle` do
  documento anterior não garante que um import lazy pós-transição terminou.
- Fixture AMX **sintética**, substituída somente nas respostas do Playwright,
  chamou `_MapChangeCore(225,7,0,18,1,0,0,0,0)` pelo NPC. O engine real carregou
  zona 225, aplicou `(7,18)/up` e renderizou o interior. Não se alteraram fontes,
  assets ou hooks de produção para esse teste. Isso não valida ramo de warp de
  uma cutscene completa da ROM.
- Zero `pageerror` nos smokes finais. Screenshots inspecionados em
  `/tmp/events-abi-rom-dialogue.png`, `/tmp/events-abi-scripted-warp.png` e
  `/tmp/events-abi-boundary-walking.png`. Scripts de reprodução temporários:
  `/tmp/playwright-test-events-abi.js` e `/tmp/playwright-test-boundary-events.js`.

P-013 permanece aberta: ramos naturais com `float/floatadd`, consultas de ator,
serviços de cenário/party e globais fora do bundle ainda não executam por
completo. MsgLoad tem evidência estática e testes sintéticos, não uma sequência
inteira de mensagens auxiliares validada no emulador. ACMD, câmera, slots de
mensagens em continuations concorrentes, callbacks completos, persistência
AMX/save/party/bag e paridade de altura/flags exigem investigação adicional.

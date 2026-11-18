# ADR-004 — Host conservador de eventos AMX

- **Status:** Aceito no escopo parcial aprovado pelo coordenador
- **Data:** 2026-11-17
- **Escopo:** Fase 2/P-013, continuação de PRD-003 e ADR-003

> Registro da primeira entrega. A apresentação dos diagnósticos, política de
> projeção do player, ABI e recursos locais foram atualizados por
> [ADR-005](ADR-005-abi-cro-e-init-nao-bloqueante.md). Efeito opaco agora fica
> suspenso no console/estado, sem textbox e sem bloquear movimento; os limites
> e resultados abaixo descrevem a etapa histórica inicial.

## Contexto

O runtime usa `maps_v2`, mas as interações antigas não consultavam `MapNpc.script`.
O corpus contém 536 disassemblies de zonas, porém `opening-memory.json` só
fornece memória inicial validada para 19 imagens: zonas 6/23/223–227 e globais
15/47/57/69/78. Não é correto inicializar os demais programas com dados zerados.

O smoke revelou efeitos anteriores ao texto: NPC 0 de Littleroot/script 14 pede
ACMD e olhar; o init de entidades da zona 6 para em `BuildMdlGetHandleByGPos`.
A política conservadora abaixo foi aprovada explicitamente pelo coordenador,
sem declarar que os serviços opacos foram implementados ou validados na ROM.

## Decisão

- Resolver scripts por vínculo único de zona/ator/scriptId, preservando o programa
  local ou global de origem. Não escolher entre candidatos ambíguos.
- Carregar JSONs por `import.meta.glob`, sob demanda e com cache. Conferir SHA da
  imagem contra o disassembly antes de fornecer `AmxBundle` à VM. Os cinco globais
  com memória disponível acompanham o bundle da zona; não se carrega o corpus
  inteiro no navegador.
- Manter `ZoneEvents` no engine como serviço de ciclo de vida, com portas para
  estado, projeção de atores, diálogo, frames e diagnóstico. O core continua puro.
- Executar `entities/case 1` ao entrar em uma zona que disponha dessa imagem e
  desse case. Isso não afirma que todos os callbacks de entrada foram roteados.
- Preservar flags/vars do mundo AMX entre invocações na mesma sessão. Recriar
  atores por zona e projetar posição/direção/visibilidade de NPCs no renderer.
  NPC visível ocupa o tile; invisível não bloqueia movimento nem interação.
- `TalkMdlMsg_Seq.args[0]` seleciona a linha do banco StoryText da zona. A janela
  pausa até tecla; `LastKeyWait` e `_ABKeyWait` também exigem entrada explícita.
  Texto ausente é erro nomeado, não diálogo genérico inventado como se fosse ROM.
- `_Suspend/HALT 12` consome exatamente os frames fornecidos pela porta do host;
  no navegador, um frame corresponde a um `requestAnimationFrame`, não a uma
  suposição de taxa fixa em milissegundos.
- Comandos cosméticos de ACMD/câmera e quatro operações de olhar/fala permanecem
  opacos. A UI informa o nome e o retorno de stub antes de aceitar Enter:
  `MdlAcmdUpdate=1`, demais pedidos cosméticos `=0`. A VM só recebe esse retorno
  após confirmação; o pedido original continua em `world.effects`. Não há
  execução da animação nem prova da ABI por essa confirmação.
- `SEPlay` usa modo silencioso diagnosticado, com retorno convencional 0; não
  se finge reproduzir o som. Consultas de áudio não recebem sucesso automático.
- O host declara não possuir half-sit/turn-ACMD (`0`), conclui setup/fim lógico
  de conversa e marcadores de tecla como operações sem animação (`0`), e informa
  campo carregado (`_FieldMapBlockIsLoading=0`) após o loader de mapa terminar.
- Nativas fora dessa política interrompem a invocação com diagnóstico visível e
  liberam input. Scripts sem vínculo/imagem usam diálogo genérico explicitamente
  separado do caminho AMX. Não há fallback genérico após fingir concluir um script.
- Reset invalida cargas/esperas antigas por geração. O serviço pode receber
  fixtures sintéticas por injeção de loader, sem ROM, DOM ou WebGL nos testes.

## Limites e próximos passos

O escopo entregue não cobre `MsgLoad/MsgSwap/MsgIsLoaded` nem a seleção de bancos
GameText. Não foi deduzida a ABI de `_MapChangeCore` a partir de sua aridade:
`WarpSetID` continua sendo somente um ID, não o par zona/warp do IR normalizado.
Warps de navegação existentes continuam funcionando e chamam o init do destino;
warps comandados por AMX aguardam evidência da assinatura e teste por zona.

Flags/vars AMX são de sessão: não se adicionou migração/persistência ao save de
jogo, nem projeção de party/bag do jogo para o mundo AMX. `spawnFlag`, gatilhos,
furniture, init de mapa e história completa continuam em P-013/P-017. Posição
AMX é projetada como tile x/z, sem resolver altura, offset mundial de todas as
zonas ou coreografia ACMD. Modelos/expressões mantêm os limites de P-019.

Próxima etapa: ampliar memória inicial com SHA por programa/zona, rastrear
`MsgLoad` e `_MapChangeCore` até argumentos comprovados e substituir cada stub
por serviço validado. Nenhuma dessas lacunas é fechada pelo smoke visual.

## Evidência

- Regressão determinística de colisão com NPC falhou (`true` em vez de `false`)
  antes da correção; as novas suítes têm dez testes sintéticos de host/ciclo de vida.
- `npm test && npm run build`: 160 testes/25 arquivos e build passando; permanece
  o aviso Vite de chunks maiores que 500 kB (`game` aproximadamente 851 kB).
- Playwright visível, Vite iniciado no checkout principal em porta 5178, root de
  código apontando para o worktree e `publicDir` principal, sem trocar branches
  ou copiar assets: NPC 0/script 14, jogador (24,20)/up, banco zona 6/linha 6.
- Texto observado: “Boy, am I glad there was an intrepid guy / like you around to
  rescue the professor.” Cinco confirmações cosméticas precederam a janela;
  `SEPlay(393216)` foi diagnosticado como silencioso. Init interrompido no query
  de construção foi observado e não mascarado.
- Zero `pageerror`; houve mensagens tardias de recurso 404, sem prova de que
  todos os recursos da página estejam presentes. Screenshots inspecionados:
  `/tmp/events-layer-before-npc.png` e `/tmp/events-layer-rom-dialogue.png`.
  Script temporário: `/tmp/playwright-test-events.js`.

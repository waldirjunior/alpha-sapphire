# Handoff técnico: fim da Onda 13 (2026-11-20)

Passagem de bastão para a próxima sessão/IA. Complementa [HANDOFF-2026-11-20.md](HANDOFF-2026-11-20.md). A fila viva continua em [../ROADMAP.md](../ROADMAP.md) e o placar em [../STATUS.md](../STATUS.md).

## 1. Estado verificado (integração da Onda 13)

- `npm run verify`: 87 arquivos / 649 testes Vitest, build, 263 testes Python (1 skip, assets de mapa ausentes em worktree).
- `npm run test:e2e` (com `ALPHA_PUBLIC_DIR` apontando para o checkout principal): 41/41 em 7,3 min, incluindo `corridor.spec.ts` (7,3 min sozinho) e `campaign.spec.ts` (3,4 min).
- O worker do #6 reportou que o e2e completo travou no `corridor.spec.ts`. Na integração ele passou. O teste é lento, não quebrado: não use timeout curto.

## 2. O que a Onda 13 entregou

| Item | Commits | Resultado |
| --- | --- | --- |
| #5 batalha | `8f6258d`, `adc40e7`, `ba19557` | Extrator ROM gera `src/data/battle/trainers.json` (949 treinadores: classe, byte IV, golpes explícitos em 284 membros, item em 78). Splash sem efeito. Teleport em batalha selvagem e bloqueio de fuga por Block, Mean Look e Spider Web. |
| #6 arenas | `4065cf0` | BCHs embutidos nos pacotes BG dos slots 44/78 extraídos: 19 texturas de caverna e 9 de ginásio. Engine mapeia cave/gym com fallback procedural (A-122). |
| #4 PICA/PokéNav | `36b343f` | Só evidência: triagem de `ExeFS/code.bin` (A-123). `LightSetIndex` continua sem binding. |
| #3 Roxanne | `5c78b98` | **Não integrado** (ver seção 4). |

## 3. O que NÃO está pronto (leia antes de assumir)

- `trainers.json` **não tem consumidor**: nada em `src/` o importa. A conversão do byte IV para os seis IVs não foi provada (P-010). Não ligue o dado ao host sem essa prova.
- 77 golpes `quality` 13 sem tratamento, lista em P-010. Candidatos seguintes: Bestow, Switcheroo, Focus Energy, Endure. Teleport de campo e interação com troca/Ghost precisam do Azahar.
- Surf/pesca/horda no host e UI de item evolutivo: não iniciados.
- Arenas: paridade visual completa de texturas aberta; só um cenário E2E de cave/gym foi revisado.
- P-007 (binding de luz PICA) e P-011 (ícones/semântica do PokéNav) abertos. Toques no Azahar não deram semântica estável.
- P-013: campanha para em `PokePartyGetParam(0,8,0)` em `zone_0441`. Stone Badge não entregue.
- Item #1 da fila segue bloqueado por falta de save ORAS avançado com Bike/Surf.

## 4. Branch não integrada

`w13-roxanne-party-badge` @ `5c78b98` (worktree `~/orca/workspaces/alpha-sapphire/w13-roxanne-party-badge`). É só documentação de P-013/PRD-003. Resultado do worker: `failed`, porque o Azahar não chegou à Roxanne. Leituras vistas no disassembly de `PokePartyGetParam`: seletor 8 (bits em +0x34 e +0x04), 44 (bit 0 do byte +0x15), 53 (byte +0x2f), 0 (u16 em +0). Nomes e valores não têm prova. Próximo ensaio: chegar à Roxanne pelo warp ROM no Azahar e ler os retornos reais. Integre com `git merge` se quiser o texto; pode haver conflito em `docs/PENDENCIAS.md`.

## 5. Próximos passos sugeridos (ordem)

1. **Save ORAS avançado**: destrava #1 e #3 de uma vez. Sem ele, ambos ficam parados em evidência de emulador.
2. #4: rastrear o callsite de `LightSetIndex` só por disassembly (sem emulador).
3. #5: lotes por mecânica comum nos 77 golpes restantes, com teste antes do código; depois Surf/pesca/horda e item evolutivo.
4. #6: comparação lado a lado das texturas de arena com o Azahar.
5. #7 multiplayer, quando a Fase 2 fechar.

## 6. Lições operacionais desta sessão

- **Azahar é recurso compartilhado**: o RPC usa a porta fixa UDP 45987 (`scripts/azahar_rpc.py`). Dois workers em paralelo se bloqueiam. Antes de abrir: `lsof -nP -iUDP:45987`. Nunca encerre processo de outro worker. Para evitar, não dispare dois itens que usam o emulador na mesma onda.
- **Workers Codex entregam fatias pequenas**: o #5 fechou 1 golpe por rodada até receber instrução de lote. Peça lotes por mecânica e uma meta numérica no spec.
- **IDs de aprendizado**: workers paralelos geram `A-TMP-<nome>`; o coordenador renumera na integração (feito: A-122, A-123). O próximo livre é A-124.
- **macOS**: `sed -i ''` (com argumento vazio) e não há `timeout` no shell. Worktree novo precisa de `npm ci` antes do `verify`.
- **Orca**: `orca orchestration worker-start --spec ... --worktree new-child --name <n> --agent codex`; agentes instalados: claude, codex, kiro, cursor, grok, devin, antigravity, claude-agent-teams. Respostas chegam por `orca orchestration check --run <run> --terminal <term>`; responda perguntas com `reply` e mande trabalho novo com `send --to dispatch:<id>`.
- Worktrees da onda, para limpeza quando quiser: `integrate-wave-12`, `integrate-wave-13` e os `w13-*` e da Onda 12 em `~/orca/workspaces/alpha-sapphire/`. Remover com `orca worktree rm` só depois de confirmar que a main tem os commits.

# Roadmap

O objetivo e a definição de pronto estão em [VISAO.md](VISAO.md); o estado medido, em [STATUS.md](STATUS.md). Este arquivo diz **o que fazer a seguir** (fila) e **em que fase** o projeto está. Versão anterior, com o relato de cada entrega: [historico/ROADMAP-ate-2026-11-18.md](historico/ROADMAP-ate-2026-11-18.md).

## Fila de execução

Pegue o primeiro item não bloqueado. Cada item termina quando a verificação indicada passa. Ao concluir, remova-o daqui, atualize o placar em STATUS.md e feche ou atualize a pendência.

| # | Resultado | Verificação | Ref. |
| --- | --- | --- | --- |
| 1 | Atores com ID de objeto (`0x1000`/`0x2000`: pedras, itens, bagas) renderizam o modelo real. | `assetsLoaded` passa a `corrigido` nos 23 cenários afetados. | P-017 |
| 2 | Câmera e oclusão iguais ao original nos pontos de telhado e parede, decididas pelas referências capturadas no oráculo (P-021). | `avatarVisible` passa a `corrigido` em `z0006-littleroot-telhado` e `z0445-mauville-hall`. | P-017 |
| 3 | Corredor Littleroot → Lavaridge como teste e2e versionado, portando os roteiros de `rom/harness-backup-2026-11-18/`. | Novo `e2e/corridor.spec.ts` verde. | PRD-006 a PRD-013 |
| 4 | `src/game.ts` dividido em módulos testáveis (entrada, batalha, menus, intro), sem mudar comportamento. | Smoke e2e verde antes e depois; `FROZEN_SIZES` vazio em `src/architecture.test.ts`. | P-020 |
| 5 | Nativos de apresentação AMX mais frequentes implementados, eliminando os "Enter extras" do diálogo de NPC. | Teste de smoke do diálogo fecha com um único Enter após o texto. | P-013 |
| 6 | New Game natural: da intro ao laboratório de Birch e à primeira batalha sem fixture. | Novo e2e de campanha, sem `relocateSave`. | P-013 |
| 7 | Permissões de movimento (ledges laterais, bike, Surf) fechadas por observação no emulador, dispensando as fixtures do corredor. | Testes do core por regra + corredor conectado até Lilycove. | PRD-015, P-017 |
| 8 | Camadas de piso e seleção de altura em pontes e interiores. | Cenários visuais novos nos pontos afetados, aceitos. | PRD-016, P-017 |

Regras da fila:

- Item bloqueado por ferramenta ausente não bloqueia os demais: registre o bloqueio na pendência e siga para o próximo. Máquina nova: [SETUP.md](SETUP.md).
- Trabalho novo entra na fila com resultado e verificação; sem verificação executável não entra.
- Os itens 7 e 8 são as frentes de engenharia reversa pausadas. Só retomar por disassembly depois que o emulador ([PRD-002](features/validacao-emulador/prds/PRD-002-infraestrutura-do-oraculo.md)) não tiver respondido à pergunta.

## Fases

### Fase 0 — Governança e ambiente (concluída)

Regras de engenharia, rastreabilidade por PRD/ADR, worktrees e ferramentas de extração. Referências: [core-jogo/ADR-001](features/core-jogo/adrs/ADR-001-separacao-core-engine.md), [pipeline-rom/ADR-002](features/pipeline-rom/adrs/ADR-002-isolamento-proprietario-e-worktrees.md).

### Fase 1 — Pipeline de extração (concluída para o escopo atual)

ROM → RomFS → JSON/GLB/áudio por scripts reproduzíveis. Entregue: 536 mapas por zona, textos, tabelas de batalha, scripts AMX desmontados, modelos e clipes nativos. Referências: [pipeline-rom](features/pipeline-rom/README.md), [tcc/01-pipeline-rom.md](tcc/01-pipeline-rom.md). Resíduos (materiais PICA, atores especiais, pés do jogador) seguem pela fila.

### Fase 2 — Mundo jogável fiel (em andamento)

Trocar todo placeholder por dado da ROM e fechar a fidelidade de mundo, movimento, história inicial e visual. É onde a fila acima atua.

Critérios de pronto:

- Corredor do início do jogo até o terceiro ginásio percorrido por e2e sem fixture.
- Catálogo visual com todos os cenários aceitos e comparados com a referência do emulador.
- Eventos de história desse trecho rodando pela VM AMX sem atalho manual.
- Menus e diálogos no layout do 3DS (P-011).

### Fase 3 — Sistemas completos e paridade com o emulador

Batalha Gen VI completa (P-010), arenas e efeitos reais (P-014), áudio completo (P-008) e comparação automatizada de fórmulas e fluxos contra o emulador. Referências: [batalha](features/batalha/README.md), [validacao-emulador](features/validacao-emulador/README.md).

Critérios de pronto:

- Toda mecânica listada como "ainda não simulada" em P-010 implementada e testada.
- Campanha completa até a Liga por e2e.
- Suíte de paridade em `src/ai/` cobrindo dano, captura, XP e IA com valores observados no emulador.

### Fase 4 — Multiplayer em salas e livro do TCC

Reutilizar `src/core/` no servidor ([multiplayer-salas](features/multiplayer-salas/README.md)) e consolidar capítulos e evidências em `docs/tcc/`.

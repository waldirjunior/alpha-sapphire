# Roadmap

O objetivo e a definição de pronto estão em [VISAO.md](VISAO.md); o estado medido, em [STATUS.md](STATUS.md). Este arquivo diz **o que fazer a seguir** (fila) e **em que fase** o projeto está. Versão anterior, com o relato de cada entrega: [historico/ROADMAP-ate-2026-11-18.md](historico/ROADMAP-ate-2026-11-18.md).

## Fila de execução

Pegue o primeiro item não bloqueado. Cada item termina quando a verificação indicada passa. Ao concluir, remova-o daqui, atualize o placar em STATUS.md e feche ou atualize a pendência.

| # | Resultado | Verificação | Ref. |
| --- | --- | --- | --- |
| 1 | Permissões de movimento restantes (bike e Surf) fechadas por observação no emulador com save avançado ORAS, dispensando as fixtures do corredor (ledges laterais 72/73 já fechados). | Testes do core por regra + corredor conectado até Lilycove. | PRD-015, P-017 |

Regras da fila:

- Item bloqueado por ferramenta ausente não bloqueia os demais: registre o bloqueio na pendência e siga para o próximo. Máquina nova: [SETUP.md](SETUP.md).
- Trabalho novo entra na fila com resultado e verificação; sem verificação executável não entra.
- O item 1 depende de um save ORAS avançado com Bike/Surf para observação no emulador ([PRD-002](features/validacao-emulador/prds/PRD-002-infraestrutura-do-oraculo.md)).

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

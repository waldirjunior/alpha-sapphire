# Roadmap

O objetivo e a definição de pronto estão em [VISAO.md](VISAO.md); o estado medido, em [STATUS.md](STATUS.md). Este arquivo diz **o que fazer a seguir** (fila) e **em que fase** o projeto está. Versão anterior, com o relato de cada entrega: [historico/ROADMAP-ate-2026-11-18.md](historico/ROADMAP-ate-2026-11-18.md). Passagem de bastão detalhada (2026-11-20): [historico/HANDOFF-2026-11-20.md](historico/HANDOFF-2026-11-20.md); fim da Onda 13: [historico/HANDOFF-2026-11-20-onda-13.md](historico/HANDOFF-2026-11-20-onda-13.md).

## Fila de execução

Pegue o primeiro item não bloqueado. Cada item termina quando a verificação indicada passa. Ao concluir, remova-o daqui, atualize o placar em STATUS.md e feche ou atualize a pendência.

| # | Resultado | Verificação | Ref. |
| --- | --- | --- | --- |
| 1 | *(Bloqueado por save ORAS avançado)* Permissões de movimento restantes (bike e Surf) fechadas por observação no emulador. | Testes do core por regra + corredor conectado até Lilycove. | PRD-015, P-017 |
| 3 | Interação/batalha natural da Roxanne e entrega da Stone Badge em `zone_0441` (binding e ABI CRO registrados; modo 2 do fade confirmado; campanha para em `PokePartyGetParam(0,8,0)`; leituras de seletor 0/8/44/53 vistas no disassembly, mas sem valores reais: o Azahar não chegou à Roxanne; próximo ensaio pelo warp ROM, branch `w13-roxanne-party-badge` @ `5c78b98` não integrada). | Regressão AMX + `e2e/campaign.spec.ts` avançando até a primeira nativa sem contrato; sem fixture de vitória. | PRD-003, P-013, A-114, A-116, A-119 |
| 4 | Binding de luz PICA (`LightSetIndex`): `inspect_townmap_cro.py` achou `DVLB` em `RomFS/a/` e `RomFS/shader/` e `PseudoLightingListener` (`DllField`), mas falta ligar `LightSetIndex` ao shader/BM (A-123). Paridade PokéNav: `extract_arenav_ui.py` integrou `poke_navi_map.png` (recorte 1:1), marcadores sem ciano e avatar em `areaNav.ts` com baseline aprovada (A-128); restam os 4 glifos inferiores e sua semântica no Azahar. | `scripts/test_pokemon_glb_materials.py` + `e2e/pokemonBattleModels.spec.ts` + `e2e/visual.spec.ts`. | P-007, P-011, P-012, A-112, A-118, A-121, A-123, A-125, A-128 |
| 5 | Todos os 90 golpes `quality` 13 cobertos (0 restantes); faltam conversão/uso no host do byte IV de `src/data/battle/trainers.json`, Teleport de campo e troca/Ghost com bloqueio (dependem do Azahar). | `battleMechanics.test.ts` + `src/ai/battleParity.test.ts` + `src/game/`. | PRD-002, P-010, A-117 |
| 6 | Paridade final de luz/câmera/composição das arenas contra Azahar (ambientes, plataformas `btl_O_*` de grass/water/cave/gym e `indoor` ROM extraídos; cave usa `btl_G_do_0` no slot 70 + plataforma `btl_O_do_0_m` no slot 118; conferir a composição contra Azahar). | Extrator Python + `battleArena.test.ts` + captura E2E comparada ao Azahar. | P-014, A-120, A-122 |

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

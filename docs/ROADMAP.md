# Roadmap Macro (Horizonte: 2 anos)

Planejamento em fases para sair do protótipo placeholder atual até a reconstrução jogável em Three.js alimentada por dados reais da ROM, mantendo rastreabilidade por PRDs, ADRs e documentação contínua para o **livro do TCC** em [docs/tcc/](tcc/00-arquitetura.md).

> **Regra de foco:** Cada fase só avança quando seus critérios de pronto estão verificados por testes e registrados em [STATUS.md](STATUS.md) e em [docs/tcc/](tcc/00-arquitetura.md). Não antecipar implementações de fases futuras sem necessidade da fase atual.

## Fase 0 — Governança, Planejamento e Ambiente (Meses 1 — Concluída)

**Objetivo:** Estruturar regras de engenharia (`AGENTS.md`, `CLAUDE.md`), rastreabilidade (`PRD`, `ADR`), memória operacional (`APRENDIZADOS.md`, `PENDENCIAS.md`, `STATUS.md`) e isolar o desenvolvimento em worktree.

- **Referências:** [core-jogo/ADR-001](features/core-jogo/adrs/ADR-001-separacao-core-engine.md), [pipeline-rom/ADR-002](features/pipeline-rom/adrs/ADR-002-isolamento-proprietario-e-worktrees.md).
- **Critérios de pronto:**
  - Documentação base criada e validada.
  - `ctrtool` compilado/instalado na VPS (`P-001`).
  - Worktree de desenvolvimento criado via Orca CLI para o pipeline de extração (`P-003`).

## Fase 1 — Pipeline de Extração da ROM (`3DS → RomFS → JSON/GLB`) (Meses 1–3)

**Objetivo:** Extrair `RomFS` e `ExeFS` do `.3ds` localmente (fora do Git) e criar scripts reproduzíveis para inspecionar e converter mapas, colisões, textos e modelos 3D para formatos web.

- **Referências:** [pipeline-rom/PRD-001](features/pipeline-rom/prds/PRD-001-extracao-rom.md), [pipeline-rom/ADR-001](features/pipeline-rom/adrs/ADR-001-pipeline-offline-glb-json.md), [tcc/01-pipeline-rom.md](tcc/01-pipeline-rom.md).
- **Critérios de pronto:**
  - `RomFS` extraída em diretório ignorado pelo `.gitignore` (`P-002`).
  - Inventário documentado dos arquivos relevantes da ROM (mapas, colisões, textos, modelos).
  - Scripts de conversão gerando JSONs validados por schema e `.glb` otimizados para o vertical slice.

## Fase 2 — Vertical Slice e Arco Inicial (`Littleroot Town → Route 101 → Oldale`) (Meses 4–8)

**Objetivo:** Substituir os placeholders inline de [src/main.ts](../src/main.ts) por dados reais extraídos, carregamento assíncrono de `.glb` no `SceneManager` e HUD/câmera compatíveis com exploração 3D.

- **Referências:** [engine-3d/PRD-001](features/engine-3d/prds/PRD-001-cena-3d-e-glb-sob-demanda.md), [core-jogo/PRD-001](features/core-jogo/prds/PRD-001-estado-movimento-warps.md), [core-jogo/ADR-001](features/core-jogo/adrs/ADR-001-separacao-core-engine.md).
- **Critérios de pronto:**
  - `src/data/` carregando definições reais de `littleroot_town` e `route_101` (`P-004`).
  - `SceneManager` carregando `.glb` sob demanda com fallback seguro para placeholder.
  - Diálogos básicos, interação com NPCs/placas e transição suave de warp testados no `core/`.

## Fase 3 — Sistemas de Jogo, Tabelas e Validação contra Emulador (Meses 9–14)

**Objetivo:** Implementar no `src/core/` a máquina de estados de encontros selvagens, batalha por turnos, party/inventário e persistência de flags de história, validados contra o jogo original em emulador (`Azahar`/`Citra`).

- **Referências:** [validacao-emulador/PRD-001](features/validacao-emulador/prds/PRD-001-testes-comparativos-emulador.md), [validacao-emulador/ADR-001](features/validacao-emulador/adrs/ADR-001-oraculo-emulador-e-tabelas-abertas.md).
- **Critérios de pronto:**
  - Módulo de batalha 100% puro em `src/core/` com cobertura de testes unitários em Vitest.
  - Tabelas de espécies, golpes, tipos e encontros carregadas via JSON tipado em `src/data/` (cruzando extração da ROM com bases abertas PokéAPI / Pokémon Showdown).
  - Comparação automatizada de fórmulas/dados/fluxo contra snapshots do emulador em `src/ai/`.

## Fase 4 — Multiplayer em Salas e Consolidação do Livro TCC (Meses 15–24)

**Objetivo:** Reutilizar `src/core/` no servidor para salas multiplayer, adicionar scripts de verificação em `src/ai/` e consolidar capítulos e evidências do TCC em `docs/tcc/`.

- **Fora do escopo imediato (Fases 0–2):** Multiplayer em rede, batalha completa, áudio espacial e pós-processamento avançado.

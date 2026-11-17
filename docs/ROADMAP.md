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
  - Scripts de zona: envelope Pawn/AMX v10 e compactação [decodificados](features/pipeline-rom/script-format.md) em 2026-11-17; [disassembly completo](features/pipeline-rom/script-disassembly.md) das 536 zonas/85 globais, com 615 nomes nativos e candidatos de dispatch derivados dos ZOs. Runner puro normalizado (core-jogo/ADR-002) e VM Pawn real da abertura (ADR-003/PRD-003) na Fase 2; efeitos tipados aguardam completion do host. ABI ACMD/objetos, integração gráfica, ambiguidades e paridade permanecem em P-013.
  - Scripts de conversão gerando JSONs validados por schema e `.glb` otimizados para o vertical slice.

## Fase 2 — Vertical Slice e Arco Inicial (`Littleroot Town → Route 101 → Oldale → Route 102 → Petalburg`) (Meses 4–8 — Em andamento)

**Objetivo:** Substituir os placeholders por dados reais extraídos, carregamento assíncrono de `.glb`, fidelidade visual (animações, shaders/materiais, interiores, áudio) e eventos de história iniciais.

- **Referências:** [engine-3d/PRD-001](features/engine-3d/prds/PRD-001-cena-3d-e-glb-sob-demanda.md), [engine-3d/PRD-002](features/engine-3d/prds/PRD-002-animacoes-esqueleticas-idle-walk.md), [engine-3d/PRD-003](features/engine-3d/prds/PRD-003-fidelidade-visual-mapas-e-interiores.md), [engine-3d/PRD-004](features/engine-3d/prds/PRD-004-interface-3ds-menus-party-bag-pokedex.md), [pipeline-rom/PRD-002](features/pipeline-rom/prds/PRD-002-extracao-audio-bcstm.md), [core-jogo/PRD-002](features/core-jogo/prds/PRD-002-eventos-historia-interiores-inventario.md).
- **Critérios de pronto:**
  - `src/data/` carregando mapas, textos e áudios reais (`P-004` concluída, `P-008` aberta).
  - Personagens com rig e animações `idle`/`walk` sem T-pose (`P-006`).
  - Materiais multi-textura PICA200, interiores e UI estilo 3DS (`P-007`, `P-009`, `P-011`).

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

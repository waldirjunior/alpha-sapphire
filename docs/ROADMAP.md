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
  - [Mapas por zona](features/pipeline-rom/maps-format.md) (`pipeline-rom/PRD-003`, `ADR-005`): 536 recortes MM/GR/ZO, escala 18 unidades/tile, 911 destinos resolvidos e dez referências sem diferenças tile a tile. Spawn fallback explicitamente derivado; campos residuais, anomalias e adoção no jogo em P-017.

## Fase 2 — Vertical Slice e Arco Inicial (`Littleroot Town → Route 101 → Oldale → Route 102 → Petalburg`) (Meses 4–8 — Em andamento)

**Objetivo:** Substituir os placeholders por dados reais extraídos, carregamento assíncrono de `.glb`, fidelidade visual (animações, shaders/materiais, interiores, áudio) e eventos de história iniciais.

- **Referências:** [engine-3d/PRD-001](features/engine-3d/prds/PRD-001-cena-3d-e-glb-sob-demanda.md), [engine-3d/PRD-002](features/engine-3d/prds/PRD-002-animacoes-esqueleticas-idle-walk.md), [engine-3d/PRD-003](features/engine-3d/prds/PRD-003-fidelidade-visual-mapas-e-interiores.md), [engine-3d/PRD-004](features/engine-3d/prds/PRD-004-interface-3ds-menus-party-bag-pokedex.md), [pipeline-rom/PRD-002](features/pipeline-rom/prds/PRD-002-extracao-audio-bcstm.md), [core-jogo/PRD-002](features/core-jogo/prds/PRD-002-eventos-historia-interiores-inventario.md).
- **Progresso parcial de eventos (2026-11-18):** [core-jogo/ADR-007](features/core-jogo/adrs/ADR-007-dispatch-natural-de-cenas.md)/PRD-005: init real da zona 6 + export `GetSceneChangeData` selecionam script 2/global 9881 com works preparados; Playwright confirmou warp ROM 6→227, laboratório visível e work 16496 de 3 para 4, sem fixture, warp manual ou Enter de completion. Câmera/fade/terreno e giros ACMD evidenciados no CRO têm término pelo host. NPC 0/script 14 chegou ao texto ROM sem confirmação ACMD, restando eye-to-eye explícito; loader GameText corrigido e verificado separadamente. 264 Vitest/43 arquivos, oito Python ABI/memória e build passam. Recursos novos continuam locais ignorados. Não comprova campanha desde New Game; deslocamentos/clipes ACMD, FPS/quaternion, bancos/words, callbacks e paridade permanecem em P-013.
- **Critérios de pronto:**
  - `src/data/` carregando mapas, textos e áudios reais (`P-004` concluída, `P-008` aberta).
  - `maps_v2` integrado via JSON lazy e bootstrap zone_0006 (engine-3d/PRD-005/ADR-003): GRs compostos e NPCs do slice, warps retangulares com fade básico, fallback `?maps=legacy` e saves isolados; VM/flags ainda em P-013/P-017. Bordas por zone-grid e ponte inferida 7↔24 implementadas em PRD-006/ADR-004; caminhada Playwright de 500 passos validada na main d85d534, com ida/retorno, Route103, casa e diálogo ROM; zero consoleErrors/pageErrors/missing, sem alegação de paridade gráfica.
  - Extensão de navegação até Rustboro ([engine-3d/PRD-008](features/engine-3d/prds/PRD-008-corredor-petalburg-rustboro.md)):13→27→82→26→16, ponte explícita13↔27, portais reais da floresta e contato automático MM4; testes e stage limitados concluídos,306 passos Playwright na main b5e3efc até16(47,65), com screenshots e zero consoleErrors/pageErrors/missing; MP3s nativos staged seletivamente após reproduzir HTML200/decode.
  - Extensão Rustboro–Verdanturf ([engine-3d/PRD-010](features/engine-3d/prds/PRD-010-corredor-rustboro-verdanturf.md)):16→43→75→11 sem nova ponte; contato MM4 e portais reais preservados. MdlDel/hide-flags persistentes implementados em core-jogo/ADR-006; base continua bloqueada no túnel e estado pós-evento usa fixture explícita676, sem alegar missão Peeko/RockSmash. Main9023a3f validada em325 passos com bloqueio inicial, fixture do bloco real, reload/reentrada e zero consoleErrors/pageErrors/missing;260 Vitest/148 Python sem skips/build passaram. Limites de altura/oclusão no túnel, fallbacks e paridade permanecem abertos.
  - [PRD-011](features/engine-3d/prds/PRD-011-corredor-verdanturf-mauville-slateport.md): Verdanturf11→Route11744→Mauville445/15, depois445→Route11033→Slateport14 somente pós-evento660. Sem pontes novas; portais/retângulos preservados. Staging UV/BGM e320 Vitest/150 Python/build passaram; base bloqueada e fixture real isolada comprovadas, Playwright na main pendente (A-061/A-062).
  - Personagens com rig e animações `idle`/`walk` sem T-pose (`P-006`).
  - Fidelidade de animações nativas (`P-012`): formato GF1 e slots PB/PK [mapeados](features/pipeline-rom/animations-format.md), com conversão individual e integração em GLBs texturizados comprovadas em quatro modelos/11 clipes (`AN-E8`), ampliadas para 388 saídas/544 clipes com dez amostras estruturais e falhas por modelo no manifesto (`AN-E9`, `A-012`); adoção inicial no runtime implementada em [engine-3d/PRD-007](features/engine-3d/prds/PRD-007-animacoes-nativas-no-runtime.md)/[ADR-005](features/engine-3d/adrs/ADR-005-eventos-batalha-e-clipes-nativos.md), com 96 modelos nativos e seis fallbacks por catálogo local, incluindo os NPCs já staged pela main atualizada. Eventos puros dirigem a apresentação de batalha e poses overworld; Playwright nativo validado na main ac4054d (Route 101, physical/special/damage/faint/idle, seis capturas locais e 186 Vitest); o recorte legado de Pokémon OPAQUE foi corrigido e revalidado. Expressões, combiners/cores, paridade e falhas de exportação continuam pendentes. P-019: UV0/UV1 iguais em 61 modelos não descartavam V invertido; A-044/A-045 rastrearam ChangeFace/paleta BCH e corrigiram a orientação-base em cinco GLBs com proveniência, seis regressões sintéticas e A/B de Brendan/May/Wally. PRD-009/A-047–A-049 acrescentam ChangeFace por estado puro do ator e seleção dos oito frames nos cinco materiais corrigidos; A/B AMX sintético com VM/host/engine reais validou MM0180 aberto→fechado→aberto, UV/pose fixos e segundo ator intacto (249 Vitest/build/147 Python, um skip pré-existente). Piscada automática segue pendente de clock/helper/condições, assim como ramo ROM natural, cobertura residual e emulador; não aplicar remap de P-018 nem fabricar pés. A-061/A-062 ampliam orientação-base para 79 GLBs/91 materiais com proveniência (99 MM auditados), incluindo paletas curtas e faces estáticas; 51 MM das zonas 6–16 publicados, 44 corrigidos/sete intactos, e 12 IDs especiais sem remapeamento. A/B de MM0179/MM0299/MM0221 e preservação dos 99 outputs validados; exclusões por BBox ambígua/ausência de candidato no relatório, sem flip global.

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

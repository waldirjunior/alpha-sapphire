# Features e Módulos

Cada feature ou módulo do projeto possui sua própria pasta em `docs/features/<modulo>/`, contendo:

- `README.md` — visão geral, responsabilidades, dependências e estado do módulo.
- `prds/` — Product Requirements Documents (`PRD-NNN-*.md`) + `README.md` de índice.
- `adrs/` — Architecture Decision Records (`ADR-NNN-*.md`) + `README.md` de índice.

## Módulos registrados

| Módulo | Escopo | Estado |
| --- | --- | --- |
| [pipeline-rom](pipeline-rom/README.md) | Extração da ROM `.3ds` (`RomFS`/`ExeFS`) e conversão para `.json` e `.glb` | Fase 1 (planejado) |
| [core-jogo](core-jogo/README.md) | Lógica pura de jogo (`src/core/`): estado, grid, colisões, warps e batalha | Ativo (vertical slice básico) |
| [engine-3d](engine-3d/README.md) | Renderização Three.js (`src/engine/`): cena, câmera, iluminação e `.glb` | Ativo (placeholder + `GLTFLoader`) |
| [batalha](batalha/README.md) | Encontros selvagens e motor de batalha por turnos (`src/core/battle.ts`) | Em andamento (Fase 3) |
| [validacao-emulador](validacao-emulador/README.md) | Testes comparativos contra emulador (`Azahar`/`Citra`), `src/ai/` e evidências do TCC | Planejado (Fase 2–3) |

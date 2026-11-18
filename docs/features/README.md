# Features e Módulos

Cada feature ou módulo do projeto possui sua própria pasta em `docs/features/<modulo>/`, contendo:

- `README.md` — visão geral, responsabilidades, dependências e estado do módulo.
- `prds/` — Product Requirements Documents (`PRD-NNN-*.md`) + `README.md` de índice.
- `adrs/` — Architecture Decision Records (`ADR-NNN-*.md`) + `README.md` de índice.

## Módulos registrados

| Módulo | Escopo | Estado |
| --- | --- | --- |
| [pipeline-rom](pipeline-rom/README.md) | Extração da ROM `.3ds` e conversão para JSON, GLB e áudio (`scripts/`) | Ativo: mapas, textos, tabelas, scripts AMX, modelos e clipes extraídos |
| [core-jogo](core-jogo/README.md) | Lógica pura (`src/core/`): estado, grade, colisão, warps, save e VM AMX | Ativo |
| [engine-3d](engine-3d/README.md) | Apresentação Three.js (`src/engine/`): zonas, atores, animações, materiais, host de eventos | Ativo |
| [batalha](batalha/README.md) | Encontros selvagens e motor de batalha por turnos (`src/core/battle*.ts`) | Ativo |
| [validacao-visual](validacao-visual/README.md) | Regressão visual por cenário e smoke do jogo real (`src/visual/`, `e2e/`) | Ativo |
| [validacao-emulador](validacao-emulador/README.md) | Paridade contra o original em emulador (`src/ai/`) | Parcial: valores esperados escritos à mão; nenhum dado capturado do emulador (P-021) |
| [multiplayer-salas](multiplayer-salas/README.md) | Estado autoritativo de salas (`src/core/room.ts`) | Inicial (Fase 4) |

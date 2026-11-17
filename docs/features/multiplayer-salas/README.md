# Módulo: Multiplayer em Salas (`multiplayer-salas`)

Gerenciamento puro e autoritativo de salas multiplayer em `src/core/room.ts`, reutilizando as mesmas regras de colisão, warps e estado de `src/core/gameState.ts` para rodar tanto no cliente quanto no servidor Node.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos de criação de sala, entrada/saída e sincronização de movimento.
- [adrs/](adrs/README.md) — decisões de estado autoritativo no `core/`.

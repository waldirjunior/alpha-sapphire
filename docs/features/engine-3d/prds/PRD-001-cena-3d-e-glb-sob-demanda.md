# PRD-001 — Cena 3D, Dados de Mapa e Carregamento de `.glb` sob Demanda

- **Módulo:** [engine-3d](../README.md)
- **Estado:** Planejado (Fase 2 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-16
- **ADRs relacionados:** [ADR-001](../adrs/ADR-001-threejs-consumidor-de-estado.md)
- **Pendências relacionadas:** `P-004`

## 1. Problema

Atualmente [src/main.ts](../../../../src/main.ts) define `MAPS` inline com grids 12x12 placeholder e [src/engine/SceneManager.ts](../../../../src/engine/SceneManager.ts) renderiza apenas primitivas geométricas.

## 2. Objetivo

Evoluir o vertical slice (`littleroot_town` → `route_101`) para consumir mapas JSON de `src/data/` e carregar modelos `.glb` gerados pelo módulo [pipeline-rom](../../pipeline-rom/README.md) sob demanda.

## 3. Requisitos Funcionais

- **RF-01:** Remover `MAPS` inline de `src/main.ts` e carregar definições validadas de `src/data/`.
- **RF-02:** Carregar `.glb` via `GLTFLoader` quando `map.modelUrl` estiver presente, mantendo fallback para placeholder geométrico caso ausente ou em falha de rede.
- **RF-03:** Descartar recursos Three.js (`dispose`) ao trocar de mapa para evitar vazamento de memória WebGL.

## 4. Critérios de Aceite

- [ ] `MAPS` inline removido de `src/main.ts` (`P-004` fechada).
- [ ] Transição `littleroot_town ↔ route_101` carregando dados reais e `.glb` com fallback seguro.
- [ ] `npm test && npm run build` passando sem erros.

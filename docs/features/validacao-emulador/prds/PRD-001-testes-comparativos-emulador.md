# PRD-001 — Suíte de Testes Comparativos contra Emulador e Registro TCC

- **Módulo:** [validacao-emulador](../README.md)
- **Estado:** Planejado (Fases 2 e 3 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-16
- **ADRs relacionados:** [ADR-001](../adrs/ADR-001-oraculo-emulador-e-tabelas-abertas.md)

## 1. Problema

Como o objetivo do projeto é reconstruir **Pokémon Alpha Sapphire** fielmente em Three.js ("mesma história, mesmo caminho, mesmo estilo") e documentar todo o processo para o livro do TCC, apenas testes unitários isolados não garantem fidelidade ao jogo original.

## 2. Objetivo

Criar cenários determinísticos executados em `src/core/` e comparados com estados/capturas do jogo original em emulador (`Azahar` / `Citra`), gerando evidências reproduzíveis para o TCC.

## 3. Requisitos Funcionais

- **RF-01:** Definir cenários de referência (sequência de passos, colisão, warps, diálogos, fórmulas de dano/batalha).
- **RF-02:** Comparar saídas do `src/core/` contra snapshots/estados esperados observados no emulador usando a mesma ROM `.3ds` em `rom/`.
- **RF-03:** Registrar desvios, descobertas de engenharia reversa e resultados comparativos em `docs/tcc/`.

## 4. Critérios de Aceite

- [ ] Scripts em `src/ai/` executando cenários de comparação sem depender de emulador ativo no CI unitário (usando golden snapshots versionados).
- [ ] Evidências documentadas em `docs/tcc/` a cada fase concluída.

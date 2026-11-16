# ADR-001 — Emulador como oráculo de validação e bases abertas para tabelas

- **Módulo:** [validacao-emulador](../README.md)
- **Status:** Aceito
- **Data:** 2026-11-16
- **Contexto:** Histórico de alinhamento do projeto (trabalho de 2 anos + livro do TCC).

## Contexto

O produto final roda 100% na web com Three.js (sem emulador no navegador), mas precisa reproduzir fielmente o comportamento do Pokémon Alpha Sapphire original.

## Decisão

1. Utilizar emulador (`Azahar` / `Citra`) exclusivamente **offline como oráculo de verificação** para validar rotas, colisões, textos e mecânicas contra a ROM `.3ds` original.
2. Utilizar bases abertas consolidadas (**PokéAPI** / **Pokémon Showdown**) como apoio para validação cruzada de tabelas numéricas (status base, golpes, habilidades e efetividade de tipos), combinadas aos mapas, textos e modelos 3D extraídos da ROM.

## Consequências

- **Positivas:** Evita digitação manual propensa a erro em tabelas extensas e fornece critério objetivo de fidelidade para o TCC.
- **Negativas / Custos:** Exige manter golden snapshots determinísticos nos testes para que `npm test` não dependa de emulador rodando em tempo real.

# Módulo: Batalha e Encontros (`batalha`)

Motor puro de encontros selvagens e batalha por turnos em `src/core/battle.ts`, sem dependências de Three.js ou DOM, com RNG injetável para testes determinísticos e validação contra emulador.

## Documentos do módulo

- [prds/](prds/README.md) — requisitos de encontros selvagens, fórmula de dano e turnos.
- [adrs/](adrs/README.md) — decisões arquiteturais do motor de batalha determinístico.

## Entrega — ROADMAP #5

A mochila persiste pedras evolutivas e permite aplicá-las a membros compatíveis
da equipe fora de batalha; saves antigos recebem um inventário de pedras vazio.
O host resolve encontros por método, incluindo grama, a subtabela de grama alta,
Surf, Rock Smash, varas e hordas. Os atalhos são `F` (Old Rod), `Shift+F`
(Good Rod), `Alt+F` (Super Rod), `U` (Surf), `R` (Rock Smash), `H` (horda) e
`T` (subtabela de grama alta).

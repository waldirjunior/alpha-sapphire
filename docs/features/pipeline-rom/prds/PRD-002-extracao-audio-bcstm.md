# PRD-002 — Extração e Reprodução de Áudio da ROM (`.bcstm → .ogg`)

- **Módulo:** [pipeline-rom](../README.md)
- **Estado:** Planejado (Fase 2 do [ROADMAP.md](../../../ROADMAP.md))
- **Data:** 2026-11-17
- **ADRs relacionados:** [ADR-003](../adrs/ADR-003-conversao-bcstm-para-ogg-webaudio.md)
- **Pendências relacionadas:** `P-008`

## 1. Problema

A `RomFS/sound/` extraída contém `201` arquivos `.bcstm` (músicas de Littleroot Town, Route 101, Oldale Town, Batalha Selvagem, Centro Pokémon) e `sango_sound.bcsar`, mas nenhum áudio é reproduzido no navegador.

## 2. Requisitos Funcionais

- **RF-01:** Script Python em `scripts/` para converter faixas selecionadas `.bcstm` em `.ogg` otimizados em `public/assets/audio/` (ignorado pelo `.gitignore`).
- **RF-02:** Gerenciador de áudio na camada `src/engine/` com troca automática de BGM por mapa (`map.bgmUrl`), tema de batalha e jingle de cura, respeitando a política de *autoplay* do navegador (inicia após primeira interação do usuário) e botão de *mute*.

## 3. Critérios de Aceite

- [ ] Trilhas de Littleroot Town, Route 101, Oldale Town e Batalha convertidas fora do Git.
- [x] Transição de música automática entre mapa e batalha com controle de volume/mute.
- [x] `npm test && npm run build` passando.

## Progresso (2026-11-19)

- `BgmPlayer` agora aplica volume 0–100 e mute no ganho master, e o PokéNav persiste ambos em `localStorage`; controles ligados e cobertos por testes unitários.
- `battleAudio.ts` mapeia oito contextos de batalha para faixas nativas; WIN1–3 seguem a inferência documentada em `A-027` e aguardam confirmação no emulador.
- Verificação: `npm run verify` passou (519 Vitest, 233 Python, 1 skip, build) e `npm run test:e2e` passou (37/37).

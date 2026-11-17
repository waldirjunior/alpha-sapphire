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
- [ ] Transição de música automática entre mapa e batalha com controle de volume/mute.
- [ ] `npm test && npm run build` passando.

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

## Progresso (2026-11-21, dispatch e samples `SEPlay`)

- `inspect_audio_dispatch.py --seplay-map` exporta os 72 mapeamentos literais
  comprovados para `src/data/audio/seplay_map.json`. O conversor segue ambas as
  referências de banco no detalhe BCSAR e produz um manifesto de cadeia e um
  catálogo runtime só para um CWAV único, existente e com pico PCM não zero.
- O conversor decodificou 10 samples CWAV reais para `public/assets/audio/sfx/`
  local/ignorado e não teve falhas do `vgmstream-cli`. Os quatro alvos
  prioritários têm dois candidatos cada; o host mantém esses 70 literais
  ambíguos em silêncio e só toca `0x000A0121` (BCSAR 669) e `0x000A0130`
  (BCSAR 684) como SFX nativos. Samples CWAV não representam CSEQ composto.
- `resolveSePlayNativeSfx`, `ZoneEvents` e `BgmPlayer.playNativeSfx` ligam esse
  catálogo ao runtime; erros de fetch/decode nativos permanecem silenciosos,
  enquanto cues semânticos comprovados preservam o fallback existente.
- Verificação: `npm run verify` passou (712 Vitest, build, 312 testes Python, 2
  skips); o smoke Playwright passou (7/7), incluindo ao menos uma requisição
  `/assets/audio/sfx/` com status abaixo de 400 e zero console/page errors.
- `P-008` segue aberta para composição CSEQ, prova de seleção de banco/instrumento,
  semântica acústica, variações de história e confirmação de BGM/WIN no jogo.

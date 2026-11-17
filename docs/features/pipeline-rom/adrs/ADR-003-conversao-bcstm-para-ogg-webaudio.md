# ADR-003 — Conversão offline `.bcstm → .ogg` e reprodução via Web Audio API

- **Módulo:** [pipeline-rom](../README.md)
- **Status:** Proposto (Fase 2)
- **Data:** 2026-11-17
- **Pendências relacionadas:** `P-008`

## Contexto

Navegadores não decodificam nativamente o formato DSP-ADPCM `.bcstm` do Nintendo 3DS.

## Decisão

Converter `.bcstm` offline na VPS via `vgmstream-cli` (ou decodificador DSP-ADPCM + `ffmpeg`) para `.ogg` (Vorbis/Opus) em `public/assets/audio/` (ignorado pelo `.gitignore`), mantendo pontos de loop quando aplicável.

## Consequências

- **Positivas:** Carregamento leve e suporte nativo em todos os navegadores modernos sem decoders WASM pesados.
- **Negativas / Custos:** Exige instalar `vgmstream-cli` ou `ffmpeg` na VPS para a etapa offline do pipeline.

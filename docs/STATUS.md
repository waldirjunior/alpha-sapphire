# Status

Retrato do estado verificado. **Edite as linhas; não acrescente seções nem relatos de entrega** — o relato vai para o PRD da frente. O tamanho deste arquivo é limitado por `src/docsContract.test.ts`. Histórico até 2026-11-18: [historico/STATUS-ate-2026-11-18.md](historico/STATUS-ate-2026-11-18.md).

Verificado em 2026-11-20 (macOS; suporte headless Linux validado anteriormente na `main`). Todo trabalho anterior está na `main` (handoff em [historico/HANDOFF-2026-11-20.md](historico/HANDOFF-2026-11-20.md)).

## Placar

| Medida | Valor | Como reproduzir |
| --- | --- | --- |
| Testes unitários (Vitest) | 649 em 87 arquivos, todos passando | `npm test` |
| Cobertura de `src/core` | acima da catraca de 95% linhas / 85% branches | `npm run test:coverage` |
| Testes do pipeline e do oráculo (Python) | 263 passando (1 skip só em worktree sem `public/assets/maps`) | `npm run test:py` |
| Jogo real no browser (smoke + campanha + corredor) | 7 smoke e campanha 1/1 (`e2e/campaign.spec.ts`; fade modo 2 até `PokePartyGetParam(0,8,0)`); corredor Littleroot → Lavaridge (`e2e/corridor.spec.ts`); suíte completa 41/41 em 7,3 min (Onda 13) | `npm run test:e2e` |
| Cenários visuais | 28/28 cenas do mundo aceitas; 1 comparação UI do PokéNav com AreaNav recomposta (P-011 residual de ícones/semântica) | `npm run test:e2e`, galeria e comparação em `rom/visual-report/` |
| Build | passa; aviso de chunks > 500 kB | `npm run build` |

Atores `0x1000`/`0x2000` renderizam modelo real (`failedAssets = 0`); câmera/oclusão em `z0006-littleroot-telhado` e `z0445-mauville-hall` batem com Azahar; cenários Mauville/Route 119 aceitos. Pés Brendan/May e V de corpo/faces (`A-099`) corrigidos. Refs 400×240 em `rom/visual-reference/`.

## O que funciona

- **Mundo**: 536 zonas em `src/data/maps_v2/`, sob demanda, com colisão, terreno, altura, warps, NPCs e bordas contínuas.
- **Corredor jogável**: Littleroot → Petalburg → Rustboro → Verdanturf → Mauville → Slateport → Fallarbor → Meteor Falls → bondinho → Lavaridge (trechos com fixture pós-evento: [PRD-010](features/engine-3d/prds/PRD-010-corredor-rustboro-verdanturf.md)–[PRD-013](features/engine-3d/prds/PRD-013-bondinho-mt-chimney-lavaridge.md)). Leste até Lilycove só em trechos ([PRD-014](features/engine-3d/prds/PRD-014-trechos-leste-mauville-lilycove.md)).
- **Eventos**: VM Pawn/AMX — diálogo, warp 6 → 227, hide-flags, expressões e serviços (Joy, Mãe, Poké Mart). Campanha natural até a primeira query de party na interação com Roxanne em `zone_0441` (Mart é `zone_0285`; binding `map/case 2`).
- **Batalha**: encontros usam taxas de slot ORAS em 150 zonas (grama no host; adaptadores para grama alta, Surf, Rock Smash, pesca e hordas), IVs/natureza, Substitute, 2 turnos, aprisionamento parcial, Baton Pass, pivots, itens, habilidades (clima/Moxie/Sheer Force/Magic Guard/Natural Cure/Rough Skin), hazards, voláteis, Protect/troca, captura + crítico via Pokédex, UI de golpes/evolução e IA com troca (`battleParity.test.ts`).
- **Apresentação**: 41 Pokémon GLB normalizados + curvas BCH boca/olhos (36 perfis); grama 3D; arenas ROM grass/água (cave/gym ainda procedurais)/VFX; Pokébola; BGM/fanfarras; `SEPlay` roteado; 8 samples CWAV BCSAR; AreaNav do PokéNav recomposta; volume/mudo; save `localStorage`.
- **Oráculo (Azahar 2126.2)**: roteiros intro/continue, `oras_save.py`, 25 refs visuais, RPC de posição e traço Littleroot vs `movePlayer`.

## Limites conhecidos

| Limite | Pendência |
| --- | --- |
| Campanha chega a `zone_0441`; fade modo 2 ok; pausa em `PokePartyGetParam(0,8,0)`; batalha/badge da Roxanne bloqueadas. | P-013 |
| Bike/Surf e oclusão residual (ex.: `z0015-mauville-patio`). | P-017 |
| Combiners RGB / luz PICA parciais; `a/0/0/3` com 16 luzes externas sem binding a `LightSetIndex=0`; ambiente por zona em `zoneEnvironment.ts`. | P-007 |
| PokéNav vs Azahar (ícones/semântica); CSEQ/SFX; arenas cave/gym; IVs por classe e residual Gen VI. | P-011, P-014, P-008, P-010 |

## Frentes pausadas

Duas investigações de engenharia reversa pararam sem mudança de runtime; ambas agora têm item na fila do [ROADMAP](ROADMAP.md) com o emulador como caminho preferido:

- Permissões nativas de movimento — [PRD-015](features/engine-3d/prds/PRD-015-permissoes-nativas-de-movimento.md).
- Camadas físicas e oclusão — [PRD-016](features/engine-3d/prds/PRD-016-camadas-fisicas-e-oclusao-nativas.md).

## Ambiente

Máquina nova: [SETUP.md](SETUP.md).

- ROM/assets locais: `rom/` e `public/assets/` (670 MB) fora do Git. Worktree: Playwright usa `public/` do checkout principal; Vite: `ALPHA_PUBLIC_DIR=<checkout>/public npm run dev`.
- Baselines em `rom/visual-baselines/<plataforma>/`; métricas em `e2e/visual-metrics/`.
- Node 26, Python 3.12, Playwright 1.64.1 (`npx playwright install chromium`).
- SPICA/SpicaExport/Blender em `../_tools/`, .NET 8 em `~/.dotnet`. Azahar 2126.2 em `../_tools/azahar/`, perfil `rom/emulator/`, cartucho `rom/cartridge/` ([setup](features/validacao-emulador/setup-emulador.md)).
- Harnesses antigos em `rom/harness-backup-2026-11-18/` do checkout principal.

# Status

Retrato do estado verificado. **Edite as linhas; não acrescente seções nem relatos de entrega** — o relato vai para o PRD da frente. O tamanho deste arquivo é limitado por `src/docsContract.test.ts`. Histórico até 2026-11-18: [historico/STATUS-ate-2026-11-18.md](historico/STATUS-ate-2026-11-18.md).

Verificado em 2026-11-19 (macOS; suporte headless Linux validado anteriormente na `main`). Todo trabalho anterior está na `main`.

## Placar

| Medida | Valor | Como reproduzir |
| --- | --- | --- |
| Testes unitários (Vitest) | 453 em 72 arquivos, todos passando | `npm test` |
| Cobertura de `src/core` | 95,9% linhas, 85,4% branches (catraca em 95/85) | `npm run test:coverage` |
| Testes do pipeline e do oráculo (Python) | 229 passando; 1 skip quando `public/assets/maps` não existe no checkout | `npm run test:py` |
| Jogo real no browser (smoke + corredor) | 6 de 6 fluxos (`e2e/smoke.spec.ts`) + corredor Littleroot → Lavaridge (`e2e/corridor.spec.ts`) | `npm run test:e2e` |
| Cenários visuais | 25 de 25 estáveis com referência do emulador lado a lado; **25 de 25 aceitos** sem defeito conhecido | `npm run test:e2e`, galeria em `rom/visual-report/index.html` |
| Build | passa; aviso de chunks > 500 kB | `npm run build` |

Atores com ID de objeto (`0x1000`/`0x2000` via `a/0/2/3`) renderizam o modelo real (`failedAssets = 0` nos 25 cenários), e câmera/oclusão em `z0006-littleroot-telhado` e `z0445-mauville-hall` correspondem às referências do oráculo Azahar. Pés de Brendan e May (`sw_parts02`) e orientação V de corpo/faces (`A-099`) corrigidos e verificados em todos os 25 cenários (`groundGap = -0,0001` nos close-ups). Referências 400×240 do Azahar capturadas para todos os 25 cenários em `rom/visual-reference/`.

## O que funciona

- **Mundo**: 536 zonas em `src/data/maps_v2/`, carregadas sob demanda, com colisão, terreno, altura por célula, warps e NPCs. Bordas contínuas entre zonas vizinhas.
- **Corredor jogável**: Littleroot → Petalburg → Rustboro → Verdanturf → Mauville → Slateport → Fallarbor → entrada de Meteor Falls → bondinho → Lavaridge. Vários trechos dependem de fixture de estado pós-evento ([PRD-010](features/engine-3d/prds/PRD-010-corredor-rustboro-verdanturf.md) a [PRD-013](features/engine-3d/prds/PRD-013-bondinho-mt-chimney-lavaridge.md)). O leste até Lilycove existe só em trechos independentes ([PRD-014](features/engine-3d/prds/PRD-014-trechos-leste-mauville-lilycove.md)).
- **Eventos**: VM Pawn/AMX executa scripts da ROM — diálogo de NPC, warp natural 6 → 227, remoção de atores com hide-flags persistentes, expressões faciais e interações de serviço (Enfermeira Joy cura a equipe, Mãe cura em casa e atendente do Poké Mart reabastece itens).
- **Batalha**: encontros por zona, turnos, dano, status, XP, level-up, evolução, time de até 6 e IA de treinador, tudo puro em `src/core/`.
- **Apresentação**: mapas e personagens em GLB com clipes nativos de overworld e batalha, materiais PICA sem saturação emissiva branca em interiores, grama alta 3D instanciada em `terrain === 2`, arena de batalha com sky dome, efeitos por tipo, Pokébola parabólica e câmera dinâmica, BGM por zona e save em `localStorage`.
- **Oráculo (Azahar 2126.2)**: roteiros `intro_to_first_save` e `continue_game`, relocalização de saves `main` entre zonas/matrizes (`scripts/oras_save.py`), 25 capturas de referência em `rom/visual-reference/`, leitura da posição viva via RPC (`0x08187BD4`/`0x08187BF4`) e traço diferencial de movimento em Littleroot (`src/ai/traces/littleroot_movement.json`) verificado contra `movePlayer`.

## Limites conhecidos

| Limite | Pendência |
| --- | --- |
| Campanha desde New Game não roda de forma natural: init, callbacks AMX e visibilidade inicial por `spawnFlag` (ex.: flag `612` em `zone_0006:npc:6`) pendentes; diálogo de NPC já fecha com 1 Enter (`TalkMdlMsg_Seq` + `LastKeyWait`). | P-013 |
| Permissões de movimento (ledges laterais, bike, Surf), camadas de piso e oclusão por prédios (ex.: `z0015-mauville-patio`). | P-017 |
| Iluminação, LUTs e combiners RGB dos materiais; exterior preto em cavernas. | P-007 |
| HUD de desenvolvimento em vez dos menus do 3DS; arenas de batalha geométricas; efeitos sonoros ausentes. | P-011, P-014, P-008 |

## Frentes pausadas

Duas investigações de engenharia reversa pararam sem mudança de runtime; ambas agora têm item na fila do [ROADMAP](ROADMAP.md) com o emulador como caminho preferido:

- Permissões nativas de movimento — [PRD-015](features/engine-3d/prds/PRD-015-permissoes-nativas-de-movimento.md).
- Camadas físicas e oclusão — [PRD-016](features/engine-3d/prds/PRD-016-camadas-fisicas-e-oclusao-nativas.md).

## Ambiente

Máquina nova: [SETUP.md](SETUP.md).

- ROM, dumps e assets convertidos são locais: `rom/` e `public/assets/` (670 MB) ficam fora do Git. Em worktree, o Playwright usa automaticamente o `public/` e os baselines do checkout principal (`e2e/support/checkoutPaths.ts`); para o Vite manual, `ALPHA_PUBLIC_DIR=<checkout>/public npm run dev`.
- Baselines de imagem em `rom/visual-baselines/<plataforma>/` do checkout principal; métricas versionadas em `e2e/visual-metrics/`.
- Node 26, Python 3.12, Playwright 1.64.1 com Chromium próprio (`npx playwright install chromium`).
- Conversão de modelos: SPICA, SpicaExport e Blender em `../_tools/`, .NET 8 em `~/.dotnet`. Emulador: Azahar 2126.2 em `../_tools/azahar/`, perfil isolado em `rom/emulator/`, cartucho em `rom/cartridge/` ([setup](features/validacao-emulador/setup-emulador.md)).
- Harnesses Playwright antigos, que só existiam em `/tmp`, foram copiados para `rom/harness-backup-2026-11-18/` do checkout principal.

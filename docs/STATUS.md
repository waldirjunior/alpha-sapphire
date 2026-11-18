# Status

Retrato do estado verificado. **Edite as linhas; não acrescente seções nem relatos de entrega** — o relato vai para o PRD da frente. O tamanho deste arquivo é limitado por `src/docsContract.test.ts`. Histórico até 2026-11-18: [historico/STATUS-ate-2026-11-18.md](historico/STATUS-ate-2026-11-18.md).

Verificado em 2026-11-18 na `main`, macOS e Linux (headless via Xvfb). Todo trabalho anterior está na `main`; as branches de worker já estavam integradas e foram removidas.

## Placar

| Medida | Valor | Como reproduzir |
| --- | --- | --- |
| Testes unitários (Vitest) | 418 em 64 arquivos, todos passando | `npm test` |
| Cobertura de `src/core` | 95,9% linhas, 85,6% branches (catraca em 95/85) | `npm run test:coverage` |
| Testes do pipeline e do oráculo (Python) | 209 passando; 1 skip quando `public/assets/maps` não existe no checkout | `npm run test:py` |
| Jogo real no browser (smoke) | 5 de 5 fluxos | `npm run test:e2e` |
| Cenários visuais | 25 de 25 estáveis; **2 de 25 aceitos** sem defeito conhecido | `npm run test:e2e`, galeria em `rom/visual-report/index.html` |
| Build | passa; aviso de chunks > 500 kB | `npm run build` |

Defeitos visuais registrados nos cenários: 23 com atores de ID de objeto sem modelo (P-017), 2 com avatar encoberto por telhado ou parede (P-017), 2 close-ups do jogador sem pés (P-019).

## O que funciona

- **Mundo**: 536 zonas em `src/data/maps_v2/`, carregadas sob demanda, com colisão, terreno, altura por célula, warps e NPCs. Bordas contínuas entre zonas vizinhas.
- **Corredor jogável**: Littleroot → Petalburg → Rustboro → Verdanturf → Mauville → Slateport → Fallarbor → entrada de Meteor Falls → bondinho → Lavaridge. Vários trechos dependem de fixture de estado pós-evento ([PRD-010](features/engine-3d/prds/PRD-010-corredor-rustboro-verdanturf.md) a [PRD-013](features/engine-3d/prds/PRD-013-bondinho-mt-chimney-lavaridge.md)). O leste até Lilycove existe só em trechos independentes ([PRD-014](features/engine-3d/prds/PRD-014-trechos-leste-mauville-lilycove.md)).
- **Eventos**: VM Pawn/AMX executa scripts da ROM — diálogo de NPC, warp natural 6 → 227, remoção de atores com hide-flags persistentes, expressões faciais.
- **Batalha**: encontros por zona, turnos, dano, status, XP, level-up, evolução, time de até 6 e IA de treinador, tudo puro em `src/core/`.
- **Apresentação**: mapas e personagens em GLB com clipes nativos de overworld e batalha, materiais PICA parciais, BGM por zona, save em `localStorage`.

## Limites conhecidos

| Limite | Pendência |
| --- | --- |
| Campanha desde New Game não roda de forma natural: init, callbacks AMX e vários nativos de apresentação pendentes. Cada nativo pendente exige um Enter extra do jogador. | P-013 |
| Permissões de movimento (ledges laterais, bike, Surf), camadas de piso e oclusão por prédios. | P-017 |
| Brendan e May sem pés: o conversor descarta a malha `sw_parts02` (tênis) que existe no BCH da ROM. | P-019 |
| Atores com ID de objeto (pedras, itens, bagas) aparecem como fallback. | P-017 |
| Iluminação, LUTs e combiners RGB dos materiais; exterior preto em cavernas. | P-007 |
| O emulador já roda por script, mas ainda não há save controlável, captura de referência nem teste diferencial: nenhuma paridade foi medida contra o original. | P-021 |
| `src/game.ts` tem 708 linhas e 0% de cobertura unitária; só o smoke e2e o protege. | P-020 |
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

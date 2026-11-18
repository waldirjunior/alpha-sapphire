# PRD-007 — Animações nativas no runtime

- Estado: implementado; reprodução nativa validada na main ac4054d, paridade pendente.
- Escopo: fase 2, P-012 e investigação P-019.

## Resultado

The [runtime catalog](../../../../src/data/nativeAssets.json) contains **140
local models: 99 characters and 41 Pokémon variants**. Historical verification
counts below describe earlier snapshots. The current delivery keeps this
catalog scope, including Brendan/MM0315, May/MM0314, and NPC/MM0045.

The selection includes encounters/starters/legendaries and staged characters.
A-062/A-063 audit the NPC IDs of zones 6–16 plus both player models separately:
48 native standing/movement pairs, five MM without motion, and 12 special IDs
without a proven MM mapping. No bits are masked to invent a correspondence.
Only 15 character records need new immutable GLBs; Pokémon records stay equal.

## Contrato

- O core emite eventos imutáveis de golpe, dano e queda na ordem resolvida.
- `NativeAnimationController` usa `physical` para golpes físicos e `special`
  para especiais/status; `damage` representa perda de HP e `faint` mantém a
  pose final. O primeiro `idle` tem peso integral, sem mostrar a bind pose.
- O host aguarda modelos e eventos `finished`, bloqueia ações durante a
  apresentação e só então adota o próximo estado. Troca de cena libera
  callbacks; uma versão de carga impede aplicar modelos/eventos obsoletos.
- A fila é sequencial: não possui marcadores nativos de impacto nem comprova
  equivalência temporal com o emulador.
- Clipes ausentes não são fabricados. Magikarp não tem `special/faint`;
  Tympole não tem `physical/faint`. Taillow usa seu GLB-base porque a exportação
  nativa falha por escala parental zero. MM0122–0125/MM0312 não têm seção de
  motion e também preservam seus GLBs-base. A fila não bloqueia se faltar clipe.
- Overworld usa `overworld_000` em repouso e `overworld_002` no deslocamento,
  quando presentes, com fallback `idle/walk`. Foram anexadas poses GF1 de
  índice 0 a 56 GLBs em `rom/extracted/models/runtime_characters/`. Os IDs não
  foram renomeados como semântica original comprovada.
- Pokémon preservam os estados alpha importados do GLB, sem impor o recorte
  legado 0,45 a superfícies OPAQUE. MASK/BLEND mantêm sua política; mapas e
  personagens continuam com a política anterior (A-033, P-007).
- A promoção verifica floats finitos e publica URLs com hash sem sobrescrever
  modelos públicos anteriores. Assets, poses, logs e screenshots ficam locais
  e ignorados; scripts, catálogo e evidência textual são versionados.

## P-019: resultado da investigação

A [auditoria](../../pipeline-rom/native-uv-audit.json) dos **61 personagens**
encontrou zero referências `texCoord` inválidas. Em todos os modelos, os pares
UV0/UV1 comparados são idênticos, inclusive faces de MM0315/MM0314/MM0180.
Trocar 0 por 1 não seleciona outra célula nessas saídas; `glb_uv_fix.py` não foi
alterado para mascarar o defeito com o remap de P-018.

O snapshot A-031 tinha MM0315 em `u=0,0025–0,2420`, `v=0,0048–0,4926`.
A-042/A-043 compararam o BCH: V original é `0,507449–0,995244`, com RGBA
idêntico no GLB. O rosto estava invertido e amostrava a outra linha do atlas.
A [investigação CRO/BCH](../../pipeline-rom/face-expressions.md) correlaciona
ChangeFace com a paleta 0/10/…/70 e distingue slot de material de stream UV.

A promoção agora usa [proveniência por MM](../../pipeline-rom/character-face-evidence.json)
para restaurar V em cinco casos comprovados, MM0180/0181/0212/0314/0315.
Verifica SHA, material, transformação-base e bounds antes de clonar UVs e
publicar nova URL. O catálogo mantém 102 modelos; 97 entradas não mudam.
Não há remap de canal, deslocamento arbitrário ou flip global. Imagens,
material, skin, animações, topologia e BIN-base ficam preservados.

O merge esquelético ainda não transporta estado dinâmico dos BCHs de material
ou visibilidade, nem piscada/wrap/combiners. Os demais MM não foram corrigidos
por extrapolação. Pés ausentes continuam limitação da geometria adotada:
anexar animação ou normalizar UV não cria topologia.

## Native overworld follow-up — A-062/A-063

The [per-model inventory](../../pipeline-rom/overworld-motion-coverage.json)
checks the actual MM pack and exported clip names independently. The 63 NPC
IDs of zones 6–16 plus MM0314/0315 yield 65 records:

- 48 pairs: 46 NPC models plus Brendan and May have `overworld_000` and
  `overworld_002`. Native GF1 header frame counts are 1 and 14 respectively.
  All 48 imported 000 clips have constant output samples within 1e-5; no
  breathing motion is hidden by the standing classification.
- MM0000/0122/0123/0124/0312 have no motion section. Existing static or
  procedural fallbacks remain explicit; no replacement animation is invented.
- 12 raw special IDs have no catalog MM entry and remain unmapped.

Fifteen missing index-0 exports are appended serially with `nice -n 10`:
MM0182/0189/0210/0222/0232/0247/0260/0261/0264/0265/0276/0277/0285/0309/0320.
Their sources are new files under `rom/extracted/models/runtime_characters/`
in the main checkout. No base GLB or previous immutable URL is overwritten.
All 48 standing-pose jobs pass structural validation. Face evidence is
regenerated for changed source SHA values before publication; all 99 final
outputs still pass face preservation/idempotence, with 79 GLBs/91 normalized
materials and the same seven ambiguous exclusions. Geometry, skin, images,
materials, previous clips, and original BIN prefixes remain preserved.

`NativeAnimationController` now owns both battle events and character loops.
It selects numeric native clips before legacy `idle/walk`, applies initial
standing at full weight, preserves phase when movement state repeats, and
holds standing when no movement clip exists. NPCs start standing; the existing
player movement projection chooses 002 and returns to 000. Replacement or
zone reset disposes only the owned actions/finished listener.

**Semantics boundary:** 000 is a constant native standing posture, not a
breathing-cycle reconstruction. Four inspected Chromium captures demonstrate
alternating legs/arms in 002 on Brendan while NPC0182/0221 remain standing.
The native state-machine dispatch, original walk/run categories, and cadence
are not recovered by this test. Numeric names remain unchanged. No slot3/93
is selected by duration or called an idle animation. Existing web movement
interpolation/crossfades are presentation policy, not native timing evidence.

### Browser and regression evidence

- Base173ada3, worktree code with main public assets, isolated Vite5194;
  the existing8080 server remains untouched.
- Visible Chromium149.0.7827.55; synthetic map/player states flow through
  real SceneManager sync/render and its normal clock. No manual mixer seek,
  curve replacement, UV edit, ROM script route, or emulator comparison.
- Player000→002→000; **39 bones change**, including both thighs, legs,
  feet/toes, and arms. NPC0182/0221 keep native000. Reset removes both actor
  controllers and their finished listeners.
- Four inspected PNGs and report.json stay ignored in the main checkout at
  `rom/overworld-runtime-validation/`: `00-standing`, `01-walk-a`,
  `02-walk-b`, `03-standing-again`. Zero page/console errors, warnings, or
  HTTP failures. Harness: `/tmp/playwright-test-overworld-runtime.js`.
- Two controller tests fail before the change (procedural initial idle and
  missing movement API), then pass with phase/fallback/isolation/disposal
  checks. Inventory tests reject names without native slots and unrelated93;
  the catalog test checks both native clips for every supported slice actor.
- **319 Vitest/47 files, build, and159 Python tests pass**; one pre-existing
  public-map-assets skip, inherited >500kB chunk warning, and the explicit
  AMX camera non-parity diagnostic. No new dependency. Export uses the existing
  Blender3.4.1, SPICA, and .NET8 tools.
- Missing feet remain visible as missing geometry. This work does not create
  mesh data or implement automatic blinking; A-061 records its exact blocker.

### Repeat the scoped inventory

Use the versioned catalog to keep this audit independent of other workers'
newly staged actors. `prepare_pose_jobs` can generate the existing export jobs;
filter them to the model IDs in this inventory before running the serial
batch. This delivery's 48-job manifest is ignored at
`rom/native-overworld-poses.json` in the main checkout. Rebuilding the plan
validates existing outputs; the batch skips merged jobs rather than
overwriting. Temporary planning/scope scripts are
`/tmp/prepare-slice-native-poses.py` and `/tmp/restrict-overworld-catalog.py`.

```bash
python3 scripts/audit_overworld_clips.py --root "$ROOT" \
  --catalog src/data/nativeAssets.json \
  --output docs/features/pipeline-rom/overworld-motion-coverage.json
python3 scripts/inspect_character_faces.py --root "$ROOT" \
  --catalog src/data/nativeAssets.json --spica-dll "$SPICA_DLL" \
  --output docs/features/pipeline-rom/character-face-evidence.json
python3 scripts/validate_character_faces.py --root "$ROOT" \
  --catalog src/data/nativeAssets.json \
  --evidence docs/features/pipeline-rom/character-face-evidence.json \
  --output docs/features/pipeline-rom/character-face-coverage.json
```

The broad promotion command below also includes all staged characters. On a
shared checkout, that set can grow: it temporarily included 21 newly staged
out-of-scope models during this investigation. Their immutable local copies
are not selected by this delivery; the versioned catalog keeps exactly its
original 99 character IDs and all 41 unchanged Pokémon records.

## Reprodução

Defina `ROOT` como o checkout principal com a extração local, `SPICA_DLL` como a
biblioteca utilizada pelo exportador e `BLENDER` como seu executável Blender:

```bash
python3 scripts/promote_native_assets.py --root "$ROOT" \
  --manifest docs/features/pipeline-rom/native-models-manifest.json \
  --pose-manifest "$ROOT/rom/native-runtime-poses.json"
nice -n 10 python3 scripts/native_model_batch.py --root "$ROOT" \
  --manifest "$ROOT/rom/native-runtime-poses.json" \
  --spica-dll "$SPICA_DLL" --blender "$BLENDER" --jobs 2
python3 scripts/promote_native_assets.py --root "$ROOT" \
  --manifest docs/features/pipeline-rom/native-models-manifest.json \
  --catalog src/data/nativeAssets.json
python3 scripts/audit_character_uv.py --root "$ROOT" \
  --catalog src/data/nativeAssets.json \
  --output docs/features/pipeline-rom/native-uv-audit.json
```

O plano recalcula `selected_frames` para o índice 0, sem reaproveitar os frames
do deslocamento. Saídas existentes só recebem estado `merged` após validação
estrutural; o runner retoma os jobs novos sem sobrescrever poses antigas. A
promoção é idempotente e registra SHA-256, fonte, clipes e razões de ausência.

## Verificação

- Vitest com mixer interceptado: categoria, dano, queda, retorno a idle, clipe
  ausente, descarte e peso inicial; eventos puros e resolução do catálogo.
- Após merge com `main` 6ae4d58: 185 Vitest/34 arquivos e build passaram; segue o
  aviso conhecido de chunks acima de 500 kB.
- 129 testes Python, um skip por assets públicos ausentes neste worktree; os
  assets reais estão no principal. Os 102 modelos passaram na checagem de
  floats e 61 na auditoria UV. Todas as 56 poses passaram na validação
  estrutural de cache, incluindo 18 anexadas após ampliar o staging.
- Playwright visível na main **8cb61de**, porta 5187: save isolado na Route 101
  (`zone_0023`, 13,4), Torchic Lv5 com Scratch/Ember contra Zigzagoon Lv2.
  `physical` teve 2,4 s/228 canais e 45 ossos alterados entre t=0,367 e 1,0834 s;
  damage, special/status e faint também terminaram, com faint mantido. Zero
  pageerror, warning ou HTTP>=400; modelos Pokémon nativos responderam 200.
- Seis screenshots inspecionadas e relatório ficam ignorados no principal em
  `rom/native_runtime_validation/`; observador Playwright em
  `/tmp/playwright-test-native-battle.js`. O observador delega aos métodos reais,
  sem trocar clipes ou alterar o relógio; o cenário usa RNG seed 7.
- A captura revelou recorte indevido dos corpos, também presente com mixers
  parados; diagnóstico em `rest_probe/` confirmou a influência de alphaTest.
  A-033 registra a correção restrita aos Pokémon e a regressão OPAQUE/MASK/BLEND;
  **186 Vitest/34 arquivos e build passaram**.
- **Revalidado na main ac4054d**, Chromium visível 149.0.7827.55/porta 5187:
  mesmos clipes, physical com 45 ossos alterados entre t≈0,367 e 1,082 s,
  retomada de idle e faint mantido. OPAQUE permaneceu alphaTest=0 e os corpos
  reapareceram sem intervenção diagnóstica de material. Zero pageerror, console
  error, warning ou HTTP>=400. As seis capturas finais inspecionadas e
  `report.json` estão em `rom/native_runtime_validation/final/` do principal,
  ignorados. `route101-before.png`, `route101-physical-a.png` e
  `route101-physical-b.png` mostram a mudança de pose; `route101-after.png`
  mostra a queda mantida. A-034 registra o fechamento da captura.
- P-019/A-042/A-043, sobre main 61fd0c6: 211 Vitest/38 arquivos, build e
  142 testes Python passaram (um skip pré-existente por public ausente no
  worktree), incluindo seis regressões sintéticas de orientação/publicação.
  Cinco outputs preservam imagens/skin/clipes/BIN; A/B real de Brendan, May
  e Wally inspecionou seis capturas com os arquivos publicados, sem mutação
  de UV no browser e sem pageerror/HTTP>=400.
- **Limite visual:** as cinco faces têm orientação-base corrigida, mas outros
  materiais, cores Pokémon e texturas overworld ainda podem estar incorretos.
  P-007/P-017/P-019 seguem abertas para a fidelidade residual; não foi
  demonstrada paridade com emulador, nem resolvidos combiners ou impacto nativo.
  PRD-009/A-046–A-048 acrescentam seleção explícita ChangeFace por ator nos cinco
  materiais corrigidos, com A/B de NPC e AMX sintético validado no engine real;
  piscada automática permanece pendente de clock/helper/condições nativas.
  Verificação sobre4f42e54: 249 Vitest/40 arquivos, build e147 Python, com um
  skip pré-existente por assets públicos ausentes no worktree.

# PRD-007 — Animações nativas no runtime

- Estado: implementado; reprodução nativa validada na main ac4054d, paridade pendente.
- Escopo: fase 2, P-012 e investigação P-019.

## Resultado

O [catálogo runtime](../../../../src/data/nativeAssets.json) seleciona **102
modelos locais**: 40 Pokémon e 56 personagens com GF1, mais seis GLBs-base de
fallback (`native: false`). Abrange 41 variantes Pokémon/39 espécies e 64 URLs
de personagens, incluindo Brendan/MM0315, May/MM0314 e NPC/MM0045.

A seleção combina encontros das zonas 6, 7, 23–30, starters/evoluções,
lendários e atores dessas zonas com os MM já staged no public principal. Essa
última união inclui NPCs adicionais promovidos pela main atualizada. Dez IDs
especiais de ator seguem sem correspondência MM; mantêm o fallback NPC sem
mascarar bits por suposição.

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
  demonstrada paridade com emulador, nem resolvidos combiners, expressões
  dinâmicas ou impacto nativo.

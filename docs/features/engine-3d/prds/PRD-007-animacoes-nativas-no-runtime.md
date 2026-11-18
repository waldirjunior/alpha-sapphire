# PRD-007 — Animações nativas no runtime

- Estado: implementado; Playwright no checkout principal pendente.
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
- A promoção verifica floats finitos e publica URLs com hash sem sobrescrever
  modelos públicos anteriores. Assets, poses, logs e screenshots ficam locais
  e ignorados; scripts, catálogo e evidência textual são versionados.

## P-019: resultado da investigação

A [auditoria](../../pipeline-rom/native-uv-audit.json) dos **61 personagens**
encontrou zero referências `texCoord` inválidas. Em todos os modelos, os pares
UV0/UV1 comparados são idênticos, inclusive faces de MM0315/MM0314/MM0180.
Trocar 0 por 1 não seleciona outra célula nessas saídas; `glb_uv_fix.py` não foi
alterado para mascarar o defeito com o remap de P-018.

MM0315 mantém a face em aproximadamente `u=0,0025–0,2420`,
`v=0,0048–0,4926`. A escolha de expressão/transformação de atlas no export
continua aberta. O merge esquelético não transporta BCHs de material ou
visibilidade e não aplica deslocamento arbitrário de UV. Os pés ausentes nos
GLBs-base são limitação da geometria adotada: anexar animação não cria topologia.

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
- **Pendente:** Playwright visível na Route 101 na main integrada, screenshots
  antes/durante ataque e relatório de clipe, tempo e transformações observadas.
  Nenhuma screenshot foi tratada como validação executada nesta etapa.

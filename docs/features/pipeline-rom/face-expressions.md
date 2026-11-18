# Expressões de face e orientação do atlas (P-019)

Investigação sobre main `942fdb3`, em `anim-0xef-re`, 2026-11-17.
O MCP Craft Anything e seu executável não estavam disponíveis. As observações
abaixo usam leitores locais, SPICA e Capstone, sem executar código da ROM.

## CRO: expressão não é direção do olhar

`DllField.cro`, SHA-256
`9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925`:

| Nativa | Wrapper (offset de arquivo) | Observação |
| --- | --- | --- |
| ChangeFace | `0x51ac0` | Recebe ator uint16 e expressão uint8; resolve o ator e chama o stub `0x28f8`. |
| TalkMdlSetEye | `0x53554` | Recebe dois atores signed16 e um modo uint8; resolve ambos antes de chamar `0x7e5f8`/`0x8eb38`. Não é evidência de seleção da célula do atlas. |
| TalkMdlClearEye | `0x55398` | Limpa estado associado ao ator e a `0x900e4`. |
| MdlSetVisibleMesh | `0x4e374` | Lê nome de mesh da memória AMX e booleano; o helper `0x38b00` procura o nome e chama uma função virtual de visibilidade. Não cria geometria. |
| MdlSetVisible | `0x4ca0c` | Habilita/desabilita flags `4`, `0x100`, `0x1000000` do ator; não equivale a seleção de expressão. |

A importação anônima do literal do stub `0x28fc` aponta para `|static|`,
segmento 0/offset `0x2f80e8`. Em `code.bin`, base virtual `0x100000`, isso é
`0x3f80e8`. O switch compara expressão com 0–7 e carrega os floats
`0,10,20,30,40,50,60,70` de `0x3f81a0`; passa o float escolhido à chamada
`0x19c7a8`. Fora desse intervalo há um caminho de assert/fallback zero.
O destino `0x19c7a8` é outro stub: seu nome/protótipo não foi comprovado.
A correspondência com os frames BCH é uma derivação dos dois conjuntos de
valores, não um nome de função recuperado.

Reprodução inicial:

```bash
/tmp/events-abi-venv/bin/python -m scripts.cro_native_abi \
  "$CHECKOUT/rom/extracted/RomFS/DllField.cro" \
  ChangeFace TalkMdlSetEye TalkMdlClearEye MdlSetVisibleMesh MdlSetVisible \
  --bytes 0x120
```

O ambiente acima já continha Capstone 5.0.3. O layout de importações CRO foi
conferido em [CRO0](https://3dbrew.org/wiki/CRO0): segmento/offset do símbolo,
lista de patches de importação e literal do stub, não busca por proximidade de
strings.

## BCH overworld: paleta de oito estados

Nos MM0315, MM0314 e MM0180 observados, a seção 2 contém um BCH de material,
com um elemento `MaterialTexCoord1Trans` e 70 frames. Os nomes são
`rstr0049_00_eye01`, `rstr0048_00_eye01` e `rstr0010_00_eye01`.
A seção 2 de MM0315 começa em `0x52800` (337920), com 1152 bytes.
Não há animação de visibilidade nesses três BCHs de expressão.

| Frame | Translação X | Translação Y |
| --- | --- | --- |
| 0 | 0 | 0 |
| 10 | -0,25 | 0 |
| 20 | -0,5 | 0 |
| 30 | -0,75 | 0 |
| 40 | 0 | -0,5 |
| 50 | -0,25 | -0,5 |
| 60 | -0,5 | -0,5 |
| 70 | -0,75 | -0,5 |

Isso é uma paleta endereçável, não evidência de que o jogo toca 70 frames
continuamente para piscar. No transform DccMaya identidade, a matriz subtrai a
translação BCH; o sinal do deslocamento amostrado não deve ser copiado como
`Texture.offset` sem conversão. `TexCoord1Trans` endereça o transform de textura,
não prova uso do atributo de vértice UV1. O leitor registra separadamente
`TextureSources` e os valores de UV0 originais.

As estruturas PB/PK de Pokémon são distintas: os grupos de material e
visibilidade descritos em [animations-format.md](animations-format.md) não
podem ser usados como se fossem a seção 2 dos MM.

## Defeito-base observado: V invertido sem inverter a imagem

MM0315, face `rstr0002_00_fi_face`:

- UV0 original BCH: U `0,00248605–0,242036`; V `0,507449–0,995244`.
- GLB promovido: U igual; V `0,004756–0,492551`, isto é, `1−V`.
- Textura original decodificada e imagem PNG embutida no GLB têm o mesmo
  SHA-256 RGBA:
  `b94369da1fef3e65547a8ac60697ceb074c1b6057a5bf9b114b65fbddaf7bc5e`.
- A imagem não acompanhou a mudança de convenção V na passagem por
  COLLADA/Blender/glTF. O frame zero do BCH de expressão tem translação zero;
  sua ausência sozinha não explica a célula inicial errada.

O A/B diagnóstico usou o mesmo GLB, câmera, iluminação e pose congelada,
com um observador temporário do SceneManager. Restaurar V original somente
na face mostrou olhos abertos e boca na posição correta; antes, o rosto
inteiro estava de cabeça para baixo e selecionava a outra linha do atlas.
Não foi um deslocamento arbitrário de meia célula nem remap UV0↔UV1.

Evidência local ignorada no checkout principal:

- `rom/face_expression_validation/image-1.png`: atlas embutido original.
- `rom/face_expression_validation/face-before.png`: rosto original invertido.
- `rom/face_expression_validation/face-flip-v-probe.png`: diagnóstico V restaurado.
- `rom/face_expression_validation/orientation-probe.json`: câmera, mesh, UVs e erros.
- `/tmp/playwright-test-face-orientation.js`: script visível, URL parametrizada.

O servidor detectado em 8080 era uvicorn/404, não o jogo. O diagnóstico usou
Vite isolado em 127.0.0.1:5187, sem editar fontes do checkout principal.
Zero pageerror no A/B. Isso ainda é um diagnóstico, não a validação de um
asset corrigido pelo pipeline nem uma comparação com emulador.

## Correção offline e cobertura

[inspect_character_faces.py](../../../scripts/inspect_character_faces.py) e seu
leitor SPICA C# registram SHA da fonte, material, TextureSources, transformação,
bounds originais, hash RGBA e amostras da paleta. O [levantamento versionado](character-face-evidence.json)
cobre 61 MM: 12 elementos do tipo/canal examinado na seção 2. Isso não prova
ausência de expressão nos outros MM nem em outros canais/seções.

A normalização em [character_face_uv.py](../../../scripts/character_face_uv.py)
fica restrita aos cinco casos de 70 frames, fonte UV0 e transformação-base
identidade/zero no frame 0: MM0180/0181/0212/0314/0315. Exige SHA de fonte
conhecido e bounds compatíveis com 1−V; restaura somente os atributos da face
com essa correspondência. Clona accessors compartilhados para não modificar
outros materiais e mantém os bytes anteriores do BIN. Não modifica alpha,
texturas, skins, clipes ou topologia. Uma marca de proveniência e os bounds
originais permitem reprocessar o próprio output sem aplicar o flip duas vezes.

A promoção usa esse levantamento por padrão na CLI; `--face-evidence` permite
selecionar explicitamente o snapshot. SHA divergente é erro, não autorização
para adivinhar. Regenerar metadados não substitui conferir imagem/UV da fonte
quando o exportador ou seu output mudar. Os cinco casos publicados tiveram
RGBA embutido comparado ao hash BCH e idêntico, além dos bounds.

```bash
python3 scripts/inspect_character_faces.py --root "$ROOT" \
  --catalog src/data/nativeAssets.json --spica-dll "$SPICA_DLL" \
  --output docs/features/pipeline-rom/character-face-evidence.json
python3 scripts/promote_native_assets.py --root "$ROOT" \
  --manifest docs/features/pipeline-rom/native-models-manifest.json \
  --face-evidence docs/features/pipeline-rom/character-face-evidence.json \
  --catalog src/data/nativeAssets.json
python3 -m unittest scripts/test_character_face_uv.py
```

Não há conversão pesada nem reexportação de malha. Cinco URLs novas foram
publicadas nos assets ignorados do principal; as fontes e URLs antigas não
foram sobrescritas. Dos 102 registros do catálogo, 97 ficaram idênticos.

## Validação dos arquivos publicados

- Seis regressões sintéticas: fixture reproduziu V=0,125 em vez de 0,875 com
  a cópia legada; a normalização corrige, preserva o UV do corpo mesmo quando
  compartilha accessor, rejeita SHA/bounds divergentes, abstém-se sem
  proveniência e é idempotente. A publicação valida hash do output e preserva
  o arquivo de entrada.
- Nos cinco GLBs: RGBA das faces, imagens, samplers, materiais, nodes, skins,
  animações, accessors anteriores e prefixo BIN preservados. Comparação local
  em `rom/face_expression_validation/pipeline-structure.json`; verificador
  temporário `/tmp/validate-face-pipeline.py`.
- Playwright final em Chromium visível 149.0.7827.55, servidor do principal
  (d85d534 observado durante a execução), porta 5187. O catálogo novo do
  worktree foi servido por interceptação de dados; o browser buscou as URLs
  novas reais. Não houve alteração de fontes do principal ou mutação de UV no
  navegador. Câmera/luz e pose no tempo zero ficaram fixas.
- Brendan/MM0315, May/MM0314 e Wally/MM0180 tiveram A/B inspecionado. O rosto
  fica orientado e olhos abertos, com V igual à fonte. Seis PNGs e `report.json`
  em `rom/face_expression_validation/final/`, ignorados. Script temporário:
  `/tmp/playwright-test-face-pipeline.js`. Zero pageerror e HTTP>=400.

O SDK usado foi .NET 8.0.428 em `~/.dotnet/dotnet`, Python 3.12.3 e o SPICA.dll
já compilado em `_tools/SpicaExport/bin/Release/net8.0` no checkout principal
irmão. O leitor somente usa ToRGBA, sem depender de System.Drawing. A inspeção
CRO usou Capstone 5.0.3 em `/tmp/events-abi-venv`. Nenhuma dependência nova foi
adicionada ao projeto; screenshots e binários não são versionados.

## Verificação canônica

Sobre main 61fd0c6 no worktree: `npm test && npm run build` passou com
211 testes Vitest em 38 arquivos; permanece o aviso herdado de chunks >500 kB.
`python3 -m unittest discover -s scripts -p 'test_*.py'` passou com 142 testes,
um skip pré-existente porque os assets públicos estão no principal, não no
worktree. A suíte inclui as seis regressões sintéticas desta correção, sem
ROM ou WebGL. A-040/A-041 foram incorporados da main; os aprendizados desta
investigação usam A-042/A-043.

## Continuação dinâmica: ator, estado e frame (2026-11-18)

A-046–A-048 e [PRD-009](../engine-3d/prds/PRD-009-expressoes-bch-no-runtime.md)
continuam a base 4f42e54. Craft Anything permaneceu indisponível na descoberta
MCP e o executável não estava instalado; as evidências abaixo são leituras
estáticas locais, não observações do jogo original em execução.

### Observado nos binários

Além do SHA de DllField acima:

- `static.crs`: `b1976b7f480ffdeaa03cc842515472a89cc6e186d58d5022f64374a3b921005c`.
- `code.bin`: `b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16`.

| Etapa | Evidência |
| --- | --- |
| Wrapper `0x51ac0–0x51af8` | `uxth` no ator, máscara `0xff` na expressão; lookup, chamada somente se ator existe e retorno0. |
| Import `DllField:0x22b4` | `\|static\|`, segmento0/offset `0x3e366c`; endereço virtual `0x4e366c`. |
| Lookup `0x4e366c–0x4e36f4` | Percorre registros de tamanho `0xab0`, testa flag de atividade e compara o u16 de registro+`0xc` com o ID recebido. Não lê o speaker do diálogo. |
| Switch `0x3f80e8` | Resolve estado via `0x4e3d8c` e escolhe floats0/10/…/70; uint8 fora0..7 segue fallback0. |
| Getter `0x4e3d8c–0x4e3dc4` | Testa flag2, consulta objeto em ator+`0xa18`, método virtual+`0x20`, com chave ator+`0x96c`. |
| Import `static.crs:0x19c7ac` | O stub `code.bin:0x19c7a8` importa **DllField**, segmento0/offset `0x38838`; o segmento começa em arquivo `0x180`, portanto destino `0x389b8`. |
| Setter `DllField:0x389b8–0x38a38` | Exige bytes de prontidão em estado+`0x270/0x271`; aplica s0 ao objeto em estado+`0x1fc`, método virtual+`0xcc`, canal0; grava estado+`0x27c = (frame==0)`. |

A ligação **ID do ator → registro → estado → objeto/frame** foi recuperada.
O nome C++/protótipo do método virtual ainda não foi recuperado; interpretar
esse caminho como aplicação da paleta é uma derivação do fluxo, dos oito
valores e do BCH. Não se declara observação desse fluxo no emulador.

O leitor versionado agora resolve imports anônimos por endereço do patch,
com regressão sintética; não usa proximidade de strings:

```python
from pathlib import Path
from scripts.cro_native_abi import CroImage

romfs = Path("/caminho/local/rom/extracted/RomFS")
crs = CroImage((romfs / "static.crs").read_bytes())
dll = CroImage((romfs / "DllField.cro").read_bytes())
module, segment, offset = crs.anonymous_import_at(0x19c7ac)
print(module, hex(dll.segment_address(segment, offset)))
# DllField 0x389b8
```

### Implementado no host web

- `ChangeFace` deixa de ser efeito cosmético opaco: a VM guarda expressão no
  ator resolvido, replica casts/fallback0 e não inventa ator quando o lookup
  falha. A transição mantém a imutabilidade do estado recebido.
- A projeção transporta a expressão pelo ID da entidade. O player recebe a
  expressão mesmo quando spawn/borda impedem projetar sua posição; refresh
  de player não apaga a expressão. Saves validam o campo opcional0..7.
- A promoção exporta `faceAnimations` somente para os mesmos cinco modelos
  corrigidos e paletas completas0/10/…/70. Os cinco SHA/URLs publicados e
  todas as demais entradas permanecem iguais; nenhum GLB foi regravado.
- `CharacterExpressions` seleciona material por nome exato da evidência,
  nunca por uma heurística ampla de nome de olho. Clona material e textura
  por instância e aplica a matriz DccMaya: offset-base **menos** translação
  BCH. Preserva sampler, canal UV, imagem, corpo, skin, clipes e UVs.
- Expressão solicitada antes da carga é aplicada ao modelo carregado;
  descarte libera apenas clones e esquece a seleção da entidade descartada.
  Valores diretos fora0..7 são rejeitados pelo engine; fallback uint8 da
  nativa é normalizado no core, antes da projeção.

### Piscada: frames observados, clock ainda pendente

O update `DllField:0x38850–0x389ac` testa os mesmos bytes de prontidão e
`estado+0x27c`. Quando o contador em `+0x274` chega a zero, aplica **frame10**
pelo mesmo slot virtual+`0xcc` e grava2 em `+0x278`; dois updates depois aplica
**frame0**. Os floats10/0 estão em `0x389b0/0x389b4`. O setup
`0x80a5c–0x80bc8` inicializa espera como `helper(60)+60` e contador fechado0.
O update também possui caminhos de intervalos4/8 e outro byte em `+0x27d`.
A expressão explícita não-zero desliga `+0x27c`; frame0 volta a habilitá-lo.

Isso evidencia uma máquina de piscada e seus frames, mas **não** o clock do
update, o contrato do helper nem todas as condições de ativação. Não converter
contadores para ms/fps por suposição, nem usar o número70 como duração de
piscada. **Piscada idle automática não foi implementada**; permanece pendente
até evidenciar a base temporal e as condições completas.

### A/B Playwright e verificação

- Código do worktree, base4f42e54, Vite isolado em **5194** via API com
  `publicDir` apontado ao `public/` principal. A porta5187 já servia código
  antigo e não foi alterada; a tentativa inicial foi descartada ao detectar
  ausência do export novo. Não houve integração nem escrita de fontes na main.
- Chromium visível149.0.7827.55; cenário **AMX sintético** com duas entidades
  NPC MM0180 e `ZoneEvents`/VM/projeção/`SceneManager` reais. Script chama
  `ChangeFace(7,0)`, espera tecla, `ChangeFace(7,1)`, espera tecla e restaura0.
  Não é ramo natural de história nem código da ROM executado.
- GLB `/assets/native/characters/mm_0180-dd6b6a2e504c.glb`, material
  `rstr0010_00_face`, câmera/luz/pose fixas. Três PNGs inspecionados mostram
  olhos abertos → fechados → abertos. UVs e pose ficaram idênticos; a textura
  do segundo ator continuou com offset0 e não é compartilhada com a primeira.
- Frames0/10 usam offsets `(0,0)`/`(0.25,0)`. PNG inicial/restaurado têm SHA
  `f9bde6cbf5c2455aace722221bbf7cb515e4380dbcd73071b032787eb1b31735`;
  frame10 tem SHA `b495417ecf21a45be2ad7262cb59805a1c031d38147eae4dee45e3c860706aa7`.
- Zero pageerror, console error, warning ou HTTP>=400 no A/B final; GLBs200.
  Relatório e PNGs ignorados no principal em
  `rom/face_expression_validation/dynamic/`; harness temporário
  `/tmp/playwright-test-dynamic-face.js`. Não há mutação de UV pelo navegador.
- Verificação canônica atual e limites estão em [STATUS](../../STATUS.md).
  Regressões reproduziram a pausa opaca anterior, a falta de projeção da
  expressão, a falta de exportação de paleta e valores inválidos do save.

## Expansão da orientação-base — 2026-11-18 (A-050/A-051)

A base a0ab2ce foi auditada a partir dos GLBs-fonte, antes de publicar novos
outputs. A duração de 70 frames era uma restrição de reprodução de expressão,
não uma condição geométrica para restaurar V. O scanner agora busca também
materiais nativos face/head sem animação; nomes apenas selecionam candidatos.
`BaseColorUV` é um marcador derivado do scanner, não um novo target BCH.

A seleção exige material exato, SHA do GLB-fonte, RGBA **e dimensões** iguais
à textura BCH, UV0, matriz DccMaya/UV de base identidade e BBox inequívoca.
Slots nativos alternativos são comparados à imagem base-color realmente
exportada; um slot inativo com nome parecido não autoriza flip. A prova fica
em [character-face-evidence.json](character-face-evidence.json).

A publicação inicial encontrou outra restrição indevida: o BCH agrega meshes
por material, mas o exportador divide primitives com limites locais menores.
Uma fixture de duas primitives reproduziu o erro observado em
`rstr0010_00_head`. A validação agora compara a união do material ao BCH e
clona os accessors por primitive, preservando compartilhamento não elegível.

### Cobertura e exclusões

- 99 MM auditados, 98 materiais candidatos e 17 paletas: **79 GLBs / 91
  materiais normalizados**, 74 personagens adicionais aos cinco anteriores.
  Os cinco anteriores recebem também head comprovado e novas URLs imutáveis.
- Todos os sete casos curtos das 12 paletas antigas foram incluídos:
  MM0179/0298/0299/0302/0303/0318/0319. Novas paletas foram encontradas ao
  ampliar o conjunto; o runtime só exporta a sequência completa 0/10/…/70,
  sem extrapolar as curtas nem inventar piscada.
- MM0226/0232/0241/0245/0262/0270/0305: imagens coincidem, mas BBox simétrica
  satisfaz simultaneamente original e espelhado. **Nenhum flip aplicado**;
  requer correspondência por vértice para desambiguar.
- MM0122–0133 e MM0312: nenhum candidato nativo face/head no escopo examinado;
  outputs intactos. Não se conclui ausência universal de texturas/expressões.
- Zonas 6–16: 63 IDs únicos, 51 MM publicados, dos quais 44 normalizados e
  sete intactos. Outros 12 são IDs sem MM correspondente e não tiveram bits
  mascarados ou remapeamento inventado. O catálogo contém 99 personagens e
  41 Pokémon; todos os registros Pokémon permanecem iguais.
- [character-face-coverage.json](character-face-coverage.json) lista por modelo
  e zona status, materiais, exclusões, URLs, SHA e preservação. `unavailable`
  também inclui falta de motion nativo; isso não significa GLB ausente.

O validador real cobre todos os 99 GLBs: prefixo BIN e accessors anteriores,
clipes, skins, nodes, imagens, materiais, samplers e demais campos preservados;
únicas mudanças permitidas são novos UVs, referências e proveniência. Repetir
normalização/publicação não muda os bytes nem sobrescreve URLs anteriores.

### Reprodução

Use ferramentas já existentes (.NET/SPICA, Pillow 11.3.0); nenhuma dependência
nova foi instalada. Craft Anything/MCP e CLI permaneceram indisponíveis.

```bash
python3 scripts/inspect_character_faces.py --root "$ROOT" \
  --manifest docs/features/pipeline-rom/native-models-manifest.json \
  --spica-dll "$SPICA_DLL" \
  --output docs/features/pipeline-rom/character-face-evidence.json
python3 scripts/promote_native_assets.py --root "$ROOT" \
  --manifest docs/features/pipeline-rom/native-models-manifest.json \
  --catalog src/data/nativeAssets.json
python3 scripts/validate_character_faces.py --root "$ROOT" \
  --catalog src/data/nativeAssets.json \
  --evidence docs/features/pipeline-rom/character-face-evidence.json \
  --output docs/features/pipeline-rom/character-face-coverage.json
```

### A/B novo e verificação

Chromium visível 149.0.7827.55, código do worktree, Vite isolado 5194 com
`publicDir` do principal. NPCs reais no SceneManager, câmera/luz/pose fixa e
mixer em t=0; nenhum UV foi editado pelo browser. Seis capturas inspecionadas
mostram rosto/cabelo orientados, com boca/olhos nas posições corretas:

| MM | Antes | Depois |
| --- | --- | --- |
| 0179 | `mm_0179-0d02d53fd4a3.glb` | `mm_0179-c18ab2e1f75e.glb` |
| 0299 | `mm_0299-157626c5a39b.glb` | `mm_0299-11331f49d34d.glb` |
| 0221 | `mm_0221-16f75732b0e6.glb` | `mm_0221-8dec1f50a9f5.glb` |

Todos responderam 200; zero pageerror, console error, warning ou HTTP>=400.
Relatório com SHA das capturas e PNGs ignorados no principal em
`rom/face_expression_validation/expanded/`; harness temporário
`/tmp/playwright-test-expanded-faces.js`. Não foi repetida a caminhada do
corredor nem exercitada cutscene ROM. 250 Vitest/40 arquivos, build e 155
Python passaram; um skip pré-existente por assets públicos ausentes no
worktree, e aviso herdado de chunks >500 kB.

## Limites e continuação

P-019 continua aberta para BBox ambígua/correspondência por vértice, materiais
fora do escopo, wrap/combiners, visibilidade PB/PK, clock/condições de piscada
e emulador. As texturas não faciais ainda podem estar incorretas. Os pés
continuam ausentes no GLB-base e não foram reconstruídos. Orientação,
seleção, temporização e paridade são critérios separados.

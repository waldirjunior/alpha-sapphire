# Animações nativas ORAS: GF1, overworld e batalha

Investigação de `P-012`, Fases 1–2, em 2026-11-17. Base: `b060a9b`.
Nenhum arquivo de `src/` foi alterado. Não houve extração/conversão em lote.

## Resultado e limites

**`0xef` não é magic: é `239`, o contador little-endian de uma tabela
`GF1MotionPack`.** O SPICA já implementa esse formato em `Formats/GFL/`.
O wrapper local usa incorretamente `Formats/GFL2/GFMotionPack` e captura a
exceção sem informar que descartou a animação. Não é preciso inventar outro
codec para MM 0314/MM 0315.

Os clipes de batalha estão no mini pacote `PB`, seção 0. `PK` contém outra
família de ações, identificada pelos nomes `kw*` (sleep/eat/happy/touch), não
os ataques `ba*`. Ambos usam GF1. Os BCHs posteriores contêm animações de
visibilidade e materiais, incluindo coordenadas de textura para expressões.

O conversor entregue exporta **um clipe esquelético nativo por chamada**,
com o modelo, skin e nome `motion_<índice>`. Não exporta expressões, não
atribui automaticamente nomes idle/walk/attack, não instala assets no jogo
e não substitui os clipes procedurais existentes. A fidelidade visual e a
sincronização com o jogo original continuam abertas em `P-012`.

## Evidências e reprodutibilidade

Os identificadores `AN-E*` abaixo são evidências locais desta investigação,
não IDs de um serviço externo. O MCP Craft Anything não respondeu a duas
chamadas de descoberta; não houve análise por esse serviço.

| Evidência | Origem observada |
| --- | --- |
| AN-E1 | SPICA checkout `82acbd63695e4ef8b95a92ce884f25ec1044788f`; `SPICA/Formats/GFL/GF1MotionPack.cs:28–48`, `Motion/GF1MotBone.cs:21–58`, `Motion/GF1Motion.cs:27–160,164–389` |
| AN-E2 | `SPICA.WinForms/Formats/GFOWCharaModel.cs:29–43` já chama GF1 para MM; `FormatIdentifier.cs:100–105` encaminha MM, PB e PK aos leitores GFL |
| AN-E3 | Wrapper local `_tools/SpicaExport/Program.cs:98–133` chama GFL2 e engole a exceção; exportação de MM 0314 com argumentos `'' 0 2` gerou DAE sem `library_animations` nem `channel` |
| AN-E4 | Bytes de MM 0314 e 0315, tabelas abaixo; comparação com o leitor GF1; MM 0000 tem somente uma seção e não contém motion |
| AN-E5 | FATB de `RomFS/a/0/0/8`, cabeçalhos dos slots 0–17 e 2280–2297, leitura de modelos 2275/2283; só os slots solicitados foram descomprimidos |
| AN-E6 | `H3D.Open` aplicado às seções BCH não vazias de PB 8 e PK 9; contagens, tipos e nomes descritos abaixo |
| AN-E7 | Exportações GF1 → DAE → Blender → GLB; accessors numéricos finitos e canais variáveis; resultados abaixo |

Ambiente efetivamente usado: macOS, Python 3.12.3, .NET SDK `8.0.428`
(`~/.dotnet/dotnet`), Blender `3.4.1` (`55485cb379f7`). O SPICA local tem
patches de exportação DAE/PNG/skinning já utilizados pelo projeto; o hash do
checkout **não identifica sozinho esses patches locais**. Nenhuma ferramenta
compartilhada foi modificada nesta tarefa.

O checkout principal local é
`/Users/wjunior/projetos/outros/estudos-ia/projeto-testes/v1/alpha-sapphire`.
`rom/` está nesse checkout; `_tools/` é seu irmão. Worktrees não herdam esses
diretórios ignorados. Nos comandos seguintes, ajuste os caminhos:

```bash
ROOT=/Users/wjunior/projetos/outros/estudos-ia/projeto-testes/v1/alpha-sapphire
TOOLS="$ROOT/../_tools"
MM="$ROOT/rom/extracted/garc/a_0_2_1/0314.bin"
GARC="$ROOT/rom/extracted/RomFS/a/0/0/8"
python3 scripts/native_motions.py --input "$MM" --list
python3 scripts/native_motions.py --input "$GARC" --garc-slot 8 --list
```

SHA-256 das amostras (MM = arquivo extraído; PB/PK = slot descomprimido):

| Amostra | SHA-256 |
| --- | --- |
| MM 0314 | `eb16c24b213d15cd9a940e23e662420f778f0c3cf12f457a477cea1335731309` |
| MM 0315 | `45650bcb286a130479920c4d0a666929ee46702bff42bc96b6240a3bd3482638` |
| PB slot 8 | `d08ce79d969fc83fbe2ada210b5abc2e70e27ba1fcb5fa671bf8a971d329c8fe` |
| PK slot 9 | `1455d2175b64739559e382582a1b7a587acabef0365e00072c9633fda244f558` |

## Mini pacote MM/PB/PK

Todos os inteiros descritos são little-endian. Índices são zero-based.
AN-E4/AN-E5 confirmam a mesma estrutura externa:

| Offset | Tipo | Significado |
| --- | --- | --- |
| `0x00` | char[2] | MM, PB ou PK |
| `0x02` | u16 | Número de seções `S` |
| `0x04` | u32[S+1] | Offsets absolutos relativos ao início do mini pacote |
| tabela[i] | bytes | Seção i termina em tabela[i+1]; offsets iguais representam seção vazia |

MM 0314: tamanho `0x5ba00`, offsets
`[0x80, 0x43b80, 0x5b580, 0x5ba00]`.
MM 0315: tamanho `0x52c80`, offsets
`[0x80, 0x42a80, 0x52800, 0x52c80]`.
Seção 0 é BCH do modelo; 1 é GF1; 2 é BCH adicional de materiais
(encaminhamento conhecido pelo leitor MM do SPICA, AN-E2).

## GF1MotionPack: a tabela chamada de “0xef”

Offsets desta seção são relativos ao início do **motion pack**, não ao MM.
AN-E1/AN-E4:

| Offset | Tipo | Significado |
| --- | --- | --- |
| `0x00` | u32 N | Quantidade de ponteiros, incluindo o esqueleto; 239 em ambos os MM |
| `0x04` | u32 | Ponteiro para esqueleto; `0x3c4` em ambos |
| `0x08` | u32[N-1] | Ponteiros de clipes; zero = ausente |

O índice original do clipe é `posição_na_tabela - 1`. **Não compacte os
índices ao descartar ponteiros zero.** Em MM 0314, o segundo clipe presente
é índice 2, não índice 1. `GF1Motion.Index` preserva essa identidade; o
indexador `pack[i]` é uma lista compactada.

GFL2 é incompatível: interpreta todos os N ponteiros como clipes e resolve
endereços com base após o contador (`pack+4`), enquanto GF1 usa a base do
pack e reserva o primeiro ponteiro para o esqueleto. Isso explica AN-E3.

### Esqueleto

No endereço do primeiro ponteiro:

1. `u8 boneCount`, `u8 firstSkeletonBoneIndex` (43 e 0 nos dois MM).
2. `boneCount-1` registros de três bytes: parentIndex, flags, childCount.
3. `boneCount-1` nomes terminados em zero; o índice 0 é `Origin` implícito.
4. Alinhamento a quatro bytes.
5. `boneCount` registros de 28 bytes: translation XYZ float32 e quaternion
   de quatro float32 (ordem exata conforme `ReadQuaternion` do SPICA).

MM 0314: nomes acabam em `0x57a`, poses acabam em `0xa30`; primeiro clipe
em `0xa50`. MM 0315: nomes acabam em `0x57e`, poses acabam em `0xa34`; primeiro
clipe em `0xa54`. Os bytes entre poses e primeiro clipe não foram
interpretados. Os 43 bones GF1 **não** equivalem aos 50 joints do BCH de
MM 0314: use nomes, não índices de joints, para aplicar o motion.

### Registro de clipe e curvas

AN-E1 é a especificação operacional reutilizada pelo conversor:

| Offset do clipe | Conteúdo |
| --- | --- |
| `+0` | u16 OctalsCount |
| `+2` | u16 FramesCount, último frame inclusivo no leitor |
| `+4` | ceil(OctalsCount/8) palavras u24; oito códigos de 3 bits em cada palavra, menos significativo primeiro |
| após códigos | Para cada código 6/7, lista de frames intermediários: count seguido dos índices; extremos 0 e FramesCount implícitos |
| após listas | Alinhamento a 4, seguido dos valores e slopes float32 |

Frames/count usam u8 quando `FramesCount <= 255`, senão u16 com alinhamento
a dois antes das listas. O leitor ignora os dois primeiros códigos;
sua semântica continua desconhecida. A partir do terceiro código, percorre
por bone TX/TY/TZ, RX/RY/RZ e SX/SY/SZ:

| Código | Interpretação do leitor GF1 |
| --- | --- |
| 0 | Constante zero |
| 1 | Pula um vetor inteiro de três componentes; conserva pose base |
| 2 / 3 / 4 | Constantes +π/2, +π, -π/2 |
| 5 | Um float32 constante |
| 6 | Um float32 por frame da lista (curva linear na leitura) |
| 7 | Pares float32 valor/slope por frame da lista (Hermite) |

O flag `bone.flags & 8` exige conversão world→local. Reutilizamos
`ToH3DSkeletalAnimation(skeleton)` para não aplicar essas translações como
locais por engano. O SPICA aplica slope × `1/30` e sua conversão H3D usa
Hermite também para listas originalmente lineares; sua própria fonte
qualifica a escala de slope como empírica. Isso não prova fidelidade exata
à interpolação do jogo. O export DAE/Blender usa 30 fps.

### Clipes overworld observados

AN-E4; offsets relativos à seção 1:

| Índice GF1 | MM 0314 offset / frames | MM 0315 offset / frames |
| --- | --- | --- |
| 0 | `0xa50` / 1 | `0xa54` / 1 |
| 2 | `0xe20` / 14 | `0xe30` / 14 |
| 3 | `0x2538` / 224 | `0x2158` / 224 |
| 4 | `0x6238` / 16 | `0x4e4c` / 16 |
| 5 | `0x7fe8` / 16 | `0x64c8` / 16 |
| 85 | `0x983c` / 1 | `0x8010` / 1 |
| 93 | `0x99b0` / 36 | `0x8180` / 36 |
| 113 | `0xb800` / 65 | `0x92ac` / 58 |
| 114 | `0xe274` / 65 | ausente |
| 115 | `0x10cd0` / 16 | `0xb2f8` / 16 |
| 116 | `0x12010` / 50 | `0xc02c` / 60 |
| 117 | `0x154a8` / 54 | `0xe330` / 54 |

Não atribuímos idle/walk/run a esses índices sem comparação visual.

## Slots de batalha em a/0/0/8

AN-E5: GARC com 8067 entradas; início dos payloads em `0x2767c`.
A FATB fornece início e comprimento armazenado. Descomprima LZ11 antes de
interpretar o mini pacote. Offsets internos não são offsets físicos do GARC
quando o slot está comprimido.

| Slot | Offset físico | Bytes armazenados / descomprimidos | Conteúdo observado |
| --- | --- | --- | --- |
| 3 | `0x6e05c` | 187311 / 275840 | PC modelo `pm0001_00` (Bulbasaur) |
| 4 | `0x9bc0c` | 975 / 4736 | PF |
| 5 | `0x9bfdc` | 500223 / 1871232 | PT texturas |
| 6 | `0x1161dc` | 514189 / 1871232 | PT alternativo |
| 7 | `0x193a6c` | 18615 / 1050496 | PC auxiliar |
| 8 | `0x198324` | 74599 / 110016 | PB, 74 seções; GF1 na seção 0 em `0x130` |
| 9 | `0x1aa68c` | 126654 / 201164 | PK, 106 seções; GF1 na seção 0 em `0x1b0` |

A relação **modelo M → PB M+5 → PK M+6** repete-se em M=11, 2283 e
2291. O modelo M=2275 contém `pm0203_00`; M=2283 também contém a variante
`pm0203_01`. Não use `8*dex` como regra global: formas/variantes alteram o
mapeamento. Confira a tag no PC e o magic do vizinho antes de converter.
A associação M+5/M+6 é observada nas amostras, não validada em 8067 entradas.

### Identidade dos golpes e expressões

AN-E6, PB slot 8: GF1 N=29 (28 posições de motion), dez clipes presentes.
Esqueleto em `0x7c`, 50 bones. Os nomes abaixo foram lidos dos BCHs de
materiais; o alinhamento por índice é corroborado pelos slots presentes:

| Índice GF1 | Offset no GF1 | Frames | Nome BCH (prefixo `pm0001_00_`) | Uso inferido do nome |
| --- | --- | --- | --- | --- |
| 0 | `0x91c` | 42 | `ba10_waitA01` | idle |
| 1 | `0x1764` | 44 | `ba10_waitB01` | idle alternativo |
| 3 | `0x3ad8` | 15 | `ba01_landA01` | entrada/pouso |
| 4 | `0x4d4c` | 20 | `ba01_landB01` | entrada/pouso |
| 5 | `0x5734` | 20 | `ba01_landC01` | entrada/pouso |
| 8 | `0x6840` | 50 | `ba20_buturi01` | ataque físico |
| 12 | `0xc320` | 65 | `ba21_tokusyu01` | ataque especial |
| 16 | `0xfac4` | 20 | `ba30_damageS01` | hit/dano |
| 17 | `0x1146c` | 50 | `ba41_down01` | faint/queda |
| 25 | `0x140d0` | 70 | sem par no grupo principal BCH | auxiliar desconhecido |

AN-E6 permite separar as seções PB, preservando vazias:

- 0: GF1 de esqueleto.
- 1: 432 bytes = 18 × 24; hipótese: região/limites por ação, não decodificada.
- 2–19: BCH de visibilidade, índice de ação = seção−2.
- 20–37: BCH de material, índice = seção−20.
- 38–55: segundo grupo BCH de material, índice = seção−38.
- 56–73: registros auxiliares; os não vazios observados começam com `SESD`.
  Semântica não estabelecida.

Exemplos físicos dentro do PB **descomprimido**: seção 20 em `0x163b8`
(waitA), 28 em `0x1776c` (ataque físico), 36 em `0x18544` (dano), 37 em
`0x18b08` (queda), 38 em `0x19274` (segundo waitA). Os dois grupos de
materiais repetem os nomes das ações, mas são animações distintas; não os
mescle usando só o nome como chave. No primeiro grupo de Bulbasaur,
`Elements` contém Eye/LIris/RIris com `MaterialTexCoord0Trans`,
`MaterialTexCoord1Trans` e `MaterialTexCoord2Trans`; a duração coincide com
a ação esquelética. No segundo grupo, os BCHs lidos têm um registro de
animação e zero elementos. Essa é a localização das expressões,
não uma implementação de reprodução de material em glTF.

PK slot 9: N=37, 20 clipes presentes, 50 bones. Mesma organização externa,
mas com grupos de **26** ações: visibilidade 2–27, materiais 28–53 e
54–79, auxiliares 80–105. Nomes observados: `kw01_wait01`,
`kw20_drowseA01`, `kw21_sleepA01`, `kw30_hate01`, `kw32_happyA01`,
`kw33_moveA01`, `kw34_lonely01`, `kw35_playA01`, `kw36_mad01`,
`kw50_eatA01`, `kw60_touch01`. Interpretação como interação/Pokémon-Amie
é inferência dos nomes; não foi validada no emulador.

## Conversão individual e verificação

O script [native_motions.py](../../../scripts/native_motions.py) resolve a
seção correta, preserva IDs esparsos e usa o leitor GF1 do SPICA via
[export_native_motion.cs](../../../scripts/export_native_motion.cs).
[native_motion_blender.py](../../../scripts/native_motion_blender.py)
importa o DAE sem gerar keyframes procedurais e exporta o clipe a 30 fps.
O projeto .NET e seus builds vivem em diretório temporário; não se modifica
nem recompila o SPICA compartilhado. Requer seu `SPICA.dll` já compilado,
com o exportador PNG sem System.Drawing descrito em `A-004`.

```bash
git check-ignore -v rom/probe_motion_2.glb
python3 scripts/native_motions.py --input "$MM" --clip 2 \
  --output rom/probe_motion_2.glb \
  --spica-dll "$TOOLS/SpicaExport/bin/Release/net8.0/SPICA.dll" \
  --blender "$HOME/Applications/Blender3.4.app/Contents/MacOS/Blender"

python3 scripts/native_motions.py --input "$GARC" --garc-slot 8 \
  --model "$GARC" --model-slot 3 --clip 8 \
  --output rom/bulbasaur_motion_8.glb \
  --spica-dll "$TOOLS/SpicaExport/bin/Release/net8.0/SPICA.dll" \
  --blender "$HOME/Applications/Blender3.4.app/Contents/MacOS/Blender"

python3 -m unittest scripts/test_native_motions.py scripts/test_pipeline.py
npm test && npm run build
```

AN-E7: outputs locais em `rom/`, ignorados; todos os accessors foram lidos
como números e verificados com `math.isfinite`, incluindo geometria/skin:

| Amostra | Resultado observado |
| --- | --- |
| Wrapper anterior, MM 0314 índice 2 | DAE sem canais de animação |
| Novo conversor, MM 0314 índice 2 | GLB 286532 bytes, 1 skin, `motion_2`, 150 canais, 126 samplers variáveis, duração 14/30 s |
| Novo conversor, Bulbasaur PB índice 3 | GLB 492852 bytes, 1 skin, `motion_3`, 195 canais, 177 samplers variáveis, duração 15/30 s |
| Novo conversor, Bulbasaur PB índice 8 | GLB 584008 bytes, 1 skin, `motion_8`, 195 canais, 177 samplers variáveis, duração 50/30 s |

O primeiro conjunto de testes sintéticos foi escrito antes do novo módulo
e falhou por módulo ausente; depois passou. A suíte final passou com **15 testes**
(7 nativos + 8 existentes). Cobre `0xef` como contador, identidade esparsa,
seções vazias, limites inválidos, GARC/LZ11 e o export Blender via mock,
sem depender da ROM. `npm test` passou com 32 testes e `npm run build`
passou, mantendo o aviso existente de bundle maior que 500 kB.
A reprodução no wrapper antigo confirma separadamente o defeito real.

A verificação do ataque de 50 frames encontrou uma segunda regressão:
o bake do glTF terminava em 49/30 s, falhando a asserção de duração. O
script normaliza os tempos dos keyframes DAE amostrados para frames
inteiros antes do bake; a mesma asserção passou com 50/30 s. Apenas
arredondar `scene.frame_end` não resolveu na execução. A inferência é perda
do limite final por precisão float no range da ação; o teste sintético
reproduz essa classe com `49.999996` (não é uma medição do instante exato
importado). Não se arredondam poses nem se geram movimentos novos.

### O que continua desconhecido / não validado

- Não houve comparação visual com emulador nem reprodução no navegador.
- O GLB inclui geometria bruta do modelo; não aplica o filtro `sw_parts`
  de `A-006`, materiais PICA ou escala de tiles. Reutilize o clipe no
  pipeline de personagem, não substitua os assets finais por esse probe.
- O PC de Pokémon não carrega PT neste conversor: a saída serve para
  transportar a animação/rig, não para substituir o Pokémon texturizado.
- Blender emitiu avisos de IOR negativo, NumPy matmul e, em Bulbasaur,
  seis bones `L/RFeelerC09/C10/End*` não encontrados. Os accessors finitos
  e os canais variáveis não provam correção visual desses bones.
- A compilação emitiu CA1416 por APIs SPICA anotadas como Windows; execução
  no macOS concluiu. Não se alteraram políticas ou controles para ocultá-lo.
- Mapeamento semântico overworld, looping, primeiros dois códigos de curva,
  bytes auxiliares GF1, SESD e cobertura de outras espécies continuam abertos.
- Expressões exigem transportar/materializar os BCHs de material e
  visibilidade, sincronizando-os com o mesmo índice GF1; este conversor
  esquelético não faz isso. Manter `P-012` aberta até integrar e comparar.

## Integração nos GLBs texturizados

[attach_native_motions.py](../../../scripts/attach_native_motions.py) é o
wrapper pós-conversão de `extract_pokemon_glb.py` e
`convert_character_glb.py`: recebe os GLBs produzidos por esses pipelines,
exporta cada clipe GF1 com `native_motions.py` e anexa apenas os canais e
buffers de animação. Não reconverte nem substitui geometria, materiais,
imagens ou skin do GLB-base. Assim preserva PT/texturas de Pokémon e o
filtro `sw_parts` já aplicado a personagens.

[glb_native_clips.py](../../../scripts/glb_native_clips.py) faz o merge
binário, preservando o BIN original como prefixo e copiando somente
bufferViews/accessors referenciados pelos samplers de animação. Alvos são
resolvidos por nome **dentro de `skin.joints`**, não por índice nem por uma
busca global de nomes: Treecko possui um joint e um nó de modelo chamados
`pm0252_00`. Um teste reproduziu a rejeição indevida desses nomes duplicados
antes de restringir o lookup aos joints. Nomes duplicados entre joints,
joints ausentes e inverse bind matrices incompatíveis continuam sendo
erros, não retargeting silencioso.

O contrato é GLB 2 com um buffer embutido, uma skin e curvas float32 não
sparse. A compatibilidade de bind pose usa tolerância absoluta `1e-4` e
relativa `1e-5`. Geometria dos probes exportados não é copiada. Um clipe
nativo substitui somente a animação de mesmo nome; outras animações são
preservadas. O output deve ser novo: arquivos existentes não são sobrescritos.

### Manifesto explícito e execução serial

Use um array JSON de jobs. Caminhos relativos são resolvidos em relação ao
manifesto. Cada job exige `source`, `base_glb` e `output`:

- Pokémon: `source` aponta ao GARC e `model_slot` identifica o PC; o wrapper
  exige PB em `model_slot+5`, sem interpretar PK como batalha.
- Personagem: `source` aponta ao MM; omita `model_slot`.
- `clips` opcional mapeia nome final para índice GF1 original. Quando
  explícito, índice ausente é erro.
- Sem `clips`, PB seleciona `idle=0`, `physical=8`, `special=12`,
  `damage=16`, `faint=17`; ausência no source é reportada em `unavailable`,
  nunca substituída por movimento procedural. MM seleciona todos os clipes
  presentes como `overworld_NNN`, sem adivinhar semântica.
- `animations[].extras` registra `nativeGF1`, `sourceFamily`, `sourceIndex`,
  `sourceFrames` e `sourceFps=30` para rastreabilidade.

```json
[
  {
    "source": "../RomFS/a/0/0/8",
    "model_slot": 2795,
    "base_glb": "pokemon/treecko/treecko.glb",
    "output": "native_validation/treecko.glb"
  },
  {
    "source": "../garc/a_0_2_1/0315.bin",
    "base_glb": "characters/mm_0315/mm_0315.glb",
    "output": "native_validation/brendan.glb",
    "clips": {"overworld_002": 2, "overworld_093": 93}
  }
]
```

O exemplo assume manifesto em `rom/extracted/models/`. Antes de executá-lo,
confirme `git check-ignore -v rom/extracted/models/native_validation/treecko.glb`
no checkout que contém os dados. Não gere manifestos com caminhos pessoais
ou assets proprietários versionados.

```bash
python3 -B scripts/attach_native_motions.py --manifest "$JOBS" --plan
nice -n 10 python3 -B scripts/attach_native_motions.py --manifest "$JOBS" \
  --spica-dll "$TOOLS/SpicaExport/bin/Release/net8.0/SPICA.dll" \
  --blender "$HOME/Applications/Blender3.4.app/Contents/MacOS/Blender"
python3 -B -m unittest scripts/test_glb_native_clips.py \
  scripts/test_native_motions.py scripts/test_pipeline.py
```

Não há varredura automática, paralelismo ou batch implícito. `--plan` lê
somente os modelos/motions explicitamente solicitados e não chama Blender.
O script está preparado para manifestos maiores em uma janela futura de
CPU; a validação desta mudança usa somente quatro modelos, serialmente.
Expressões BCH de UV/visibilidade continuam fora do merge esquelético.

### Amostras integradas e verificação AN-E8

Saídas locais no checkout principal, em
`rom/extracted/models/native_validation/`, confirmadas ignoradas antes da
conversão. Foram quatro modelos e onze clipes, em execução serial com
`nice -n 10`; o batch de GRs em outra frente não foi alterado.

| Arquivo | Origem | Bytes | Skin / joints | Imagens / materiais | Clipes nativos e frames |
| --- | --- | ---: | --- | --- | --- |
| `treecko.glb` | PC 2795, PB 2800, tag `pm0252_00` | 1437164 | 1 / 64 | 3 / 5 | idle 40, physical 80, special 70, damage 20, faint 50 |
| `brendan.glb` | MM 0315, `rstr0002_00_fi` | 551648 | 1 / 50 | 3 / 3 | overworld_002 14, overworld_093 36 |
| `wally.glb` | MM 0180, `rstr0010_00_fi` | 415792 | 1 / 34 | 3 / 3 | overworld_002 14, overworld_093 36 |
| `roxanne.glb` | MM 0187, `rstr0017_00_fi` | 408308 | 1 / 36 | 3 / 3 | overworld_002 14, overworld_093 36 |

Os nomes Wally/Roxanne seguem a
[lista comunitária de modelos ORAS](https://gbatemp.net/threads/release-useful-notes-about-oras-for-romhacking.410017/),
consultada via resultados de busca (acesso direto retornou 403), não uma
identificação visual nesta investigação. Os IDs e tags acima foram lidos
localmente. `convert_character_glb.py` e essa lista concordam em
`0315=Brendan`, `0314=May`; os rótulos da investigação inicial foram
corrigidos para IDs de arquivo nesta página. Ver correção em `A-011`.

Verificações executadas para todos os quatro arquivos:

- O BIN original é prefixo byte a byte do novo buffer. Todos os campos
  JSON originais, exceto animations/accessors/bufferViews/buffers, são
  idênticos; isso inclui meshes, nós, skin, materiais, imagens e texturas.
- Todas as imagens continuam embutidas e todos os accessors float32 finais
  são finitos, incluindo geometria e inverse bind matrices.
- Todos os alvos dos clipes nativos pertencem à skin. Cada sampler começa
  em zero e termina em `sourceFrames/30`, com tolerância `1e-5` s.
- Treecko: 192 canais e 180 samplers numericamente variáveis por clipe;
  Brendan: 150/126; Wally: 102/96; Roxanne: 108/102.
- `idle` de Treecko foi substituído pelo nativo. Os personagens mantêm os
  antigos idle/walk procedurais e recebem os dois `overworld_NNN`; não se
  atribuiu semântica sem evidência a esses IDs.
- Passaram 28 testes Python (13 novos de merge/integração, 7 nativos e 8
  existentes), 32 testes Vitest e `npm run build` com o aviso conhecido de
  bundle maior que 500 kB. O primeiro teste de merge falhou antes do módulo
  existir; a regressão de nome duplicado falhou antes da correção.

Persistem os avisos CA1416, IOR/NumPy e `cannot find bone Jaw` em Treecko.
O merge não copia a geometria desses probes e preserva a skin do GLB-base,
mas não reconstitui o bone perdido no pipeline existente. Não houve
comparação visual, validação de looping/emulador ou reprodução de expressões;
`P-012` permanece em andamento.

## Cobertura ampla por manifesto (AN-E9)

[build_native_manifest.py](../../../scripts/build_native_manifest.py) gera
[native-models-manifest.json](native-models-manifest.json) sem caminhos de
máquina. O manifesto inclui todos os **544** diretórios `mm_NNNN`, inclusive
quando não existe motion utilizável. Os caminhos são relativos ao checkout
passado em `--root`; o checkout de dados pode ser diferente do worktree que
contém scripts e manifesto.

### Espécie, modelo e pack de batalha

O slot 0 de `a/0/0/8` contém a tabela que evita varrer/descomprimir todos os
modelos e evita adivinhar espécie pelo nome de desenvolvimento. Para os
registros utilizados, o layout derivado é:

| Campo | Offset no registro | Leitura |
| --- | --- | --- |
| Primeiro ordinal de modelo | 0 | u16 little-endian |
| Quantidade de modelos | 2 | u8 |
| Flags (significado não decodificado aqui) | 3 | u8 |

O registro da espécie fica em `4*(species-1)`. Para variante ordinal `v`,
o modelo PC está em `3+8*(first_model+v)` e o PB em `PC+5`. Cada job confere
as assinaturas PC/PB, lê o tag real do BCH e registra offsets do registro,
ordinal/variante, slots, seção GF1, hash do pack, índices presentes e frames
selecionados. Exemplos conferidos localmente:

- Espécie 252: `first=349, count=1, flags=1` → PC 2795/PB 2800,
  tag `pm0252_00`.
- Espécie 422: primeiro modelo `pm0422_11`, não `pm0422_00`.
- Espécie 650: primeiro modelo `pm0720_00`; espécie 692: `first=969` →
  PC 7755/PB 7760, tag `pm0756_00`. Logo, tag interno não é uma chave
  universal de National Dex. Não houve identificação visual desses modelos.

A indexação foi ancorada em espécies conhecidas (incluindo 1, 2, 3, 72,
98, 129, 252–254, 382 e 383) e as assinaturas/tags foram conferidas nos
41 modelos selecionados. O restante do arquivo do slot 0 e a semântica das
flags ficam fora desta investigação. Ver `A-012`.

### Política e escopo da seleção

- Personagens: um clipe por modelo para priorizar cobertura e limitar CPU:
  índice 2 quando tem mais de um frame; caso contrário, o primeiro índice
  esparso com mais de um frame. Nome `overworld_NNN`, sem inferir idle/walk.
  Todos os outros IDs presentes permanecem inventariados no manifesto.
- Pokémon: os cinco índices semânticos disponíveis de `BATTLE_CLIPS`; os
  ausentes ficam registrados em `unavailable`, sem fallback procedural.
- Encontros: união de todas as espécies positivas dos JSONs das zonas
  **6, 7 e 23–30**, com caminho/hash por arquivo e lista de espécies por
  zona em `scope.zones`. Isso inclui Route 104–107 conforme os IDs pedidos,
  não apenas Route 101–103; não implica disponibilidade pré-National Dex
  nem validação de método de encontro. Espécie zero é excluída.
- A união dos encontros tem 28 espécies: 72, 98, 118, 129, 183, 184, 261,
  263, 265, 270, 276, 278, 279, 280, 283, 284, 320, 341, 422, 441, 506,
  519, 535, 540, 570, 574, 592 e 692.
- Somam-se starters/evoluções 252–260 e lendários 382/383: **39 espécies**.
  Além do primeiro modelo de cada espécie, entram as segundas variantes
  dos dois lendários de capa: **41 modelos Pokémon**, tags `_00`/`_51`
  lidos do arquivo, sem atribuir significado às flags da tabela.

### Execução e relatório

```bash
python3 -B scripts/build_native_manifest.py --root "$ROOT" \
  --output docs/features/pipeline-rom/native-models-manifest.json
nice -n 10 python3 -B scripts/native_model_batch.py --root "$ROOT" \
  --manifest docs/features/pipeline-rom/native-models-manifest.json \
  --spica-dll "$TOOLS/SpicaExport/bin/Release/net8.0/SPICA.dll" \
  --blender "$HOME/Applications/Blender3.4.app/Contents/MacOS/Blender" --jobs 2
python3 -B scripts/validate_native_manifest.py --root "$ROOT" \
  --manifest docs/features/pipeline-rom/native-models-manifest.json --sample 10
```

O gerador reinicializa o inventário; não o execute sobre um relatório em
andamento. O executor só tenta jobs `ready`, com no máximo dois processos
de conversão e logs individuais ao lado das saídas em
`rom/extracted/models/clips_merged/`. Outputs e logs existentes não são
sobrescritos. Cada conclusão atualiza status/erro/returncode/log no JSON;
falha de um modelo não impede os seguintes e a execução retorna código 1
quando há falhas. O relatório final usa escrita atômica e prioriza a causa
real do log, não apenas o `CalledProcessError` externo. Logs integrais são
locais/ignorados; mensagens versionadas usam `$ROOT`/`$WORKTREE`/`$TEMP`.

O inventário inicial tem 585 entradas: 544 personagens e 41 Pokémon.
Dos personagens, 177 não têm seção de motion, 9 só têm poses de um frame e
358 têm ao menos um clipe selecionável; todos os 41 Pokémon têm PC/PB e
GLB-base disponíveis. Ausência de seção/pose estática é distinta de falha
em exportar um pack existente. Não se fabricam animações para preencher
essas categorias.

O validador escolhe dez saídas deterministicamente, equilibrando os dois
tipos e espaçando os índices. Confere preservação do BIN e campos do GLB,
imagens embutidas, todos os accessors float32 finitos, alvos em joints,
índices e durações nativas e timestamps estritamente crescentes. Guarda
hashes/métricas por amostra no próprio manifesto. É validação estrutural,
não visual, de emulador, de looping ou de expressões.

### Resultado observado do lote

Execução autorizada com `nice 10` e dois jobs, sem alterar bases, `src/`
ou ferramentas compartilhadas; diretório de saída conferido como ignorado.

| Tipo | Inventariados | Integrados | Sem seção GF1 | Só poses estáticas | Falhas de conversão |
| --- | ---: | ---: | ---: | ---: | ---: |
| MM | 544 | 348 | 177 | 9 | 10 |
| Pokémon | 41 | 40 | 0 | 0 | 1 |
| Total | 585 | 388 | 177 | 9 | 11 |

São **544 clipes nativos**: 348 overworld e 196 Pokémon, em 388 GLBs novos.
O executor retornou **1**, corretamente, porque 11 conversões falharam;
não houve jobs deixados `ready` nem outputs parciais dessas falhas.

- MM0024–0033: o GLB-base tem **zero skins** e o import COLLADA não produz
  action (`Native animation missing after COLLADA import`). A existência
  do pack GF1 não torna esse modelo-base um ator esqueletal animável.
- Taillow #276, tag `pm0276_00`: falha no primeiro clipe (índice 0), em
  `SPICA...DAEExporter.EvaluatePose`, com `InvalidDataException: Segment
  scale compensation has a zero parent scale`. O guard não foi removido;
  investigar fonte/compensação de escala antes de uma nova tentativa.
- #129: GF1 não possui `special`/`faint` solicitados; #535 não possui
  `physical`/`faint`. Cada um recebeu somente três clipes disponíveis;
  as ausências estão no campo `unavailable`.

As dez amostras estruturais passaram: MM0034, MM0172, MM0263, MM0350,
MM0543 e Pokémon #72, #256, #279, #383 variante 1 e #692. Os 30 clipes
nativos dessas amostras possuem valores variáveis; preservação do BIN,
accessors/bufferViews originais, demais campos-base, imagens embutidas,
valores finitos e tempos foram conferidos. Hashes e contagens estão em
`models[].validation`; a lista e modo da amostragem estão em `validation`.
A verificação passou com 42 testes Python, 32 Vitest e build; o aviso
preexistente de bundle Vite >500 kB permanece. Paridade visual/emulador,
looping, expressões e seleção dos clipes no jogo continuam fora do que foi
validado e `P-012` segue em andamento.

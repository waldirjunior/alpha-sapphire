# Animações nativas ORAS: GF1, overworld e batalha

Investigação de `P-012`, Fases 1–2, em 2026-11-17. Base: `b060a9b`.
Nenhum arquivo de `src/` foi alterado. Não houve extração/conversão em lote.

## Resultado e limites

**`0xef` não é magic: é `239`, o contador little-endian de uma tabela
`GF1MotionPack`.** O SPICA já implementa esse formato em `Formats/GFL/`.
O wrapper local usa incorretamente `Formats/GFL2/GFMotionPack` e captura a
exceção sem informar que descartou a animação. Não é preciso inventar outro
codec para Brendan/May.

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
índices ao descartar ponteiros zero.** Em Brendan, o segundo clipe presente
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

Brendan: nomes acabam em `0x57a`, poses acabam em `0xa30`; primeiro clipe
em `0xa50`. May: nomes acabam em `0x57e`, poses acabam em `0xa34`; primeiro
clipe em `0xa54`. Os bytes entre poses e primeiro clipe não foram
interpretados. Os 43 bones GF1 **não** equivalem aos 50 joints do BCH de
Brendan: use nomes, não índices de joints, para aplicar o motion.

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

| Índice GF1 | Brendan offset / frames | May offset / frames |
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
| Wrapper anterior, Brendan índice 2 | DAE sem canais de animação |
| Novo conversor, Brendan índice 2 | GLB 286532 bytes, 1 skin, `motion_2`, 150 canais, 126 samplers variáveis, duração 14/30 s |
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

# PRD-015 — Leitores e condições nativas das permissões de movimento

- **Data:** 2026-11-18.
- **Fase:** 2; P-017/P-013; A-082–A-091; continuação do PRD-014.
- **Bases:** investigação inicial em `202d74b`; A-087/A-088 em `3013f14`;
  A-090/A-091 em `ffd1154` (renumerados no merge), mesmo worktree
  `eastern-lilycove` autorizado.
- **Estado:** executor de salto por grid e executor62 recuperados; **aceitação
  completa ainda inconclusiva para implementar movimento**. Nenhum runtime,
  colisão ou mapa alterado; grounding primário herdado preservado.

## Objetivo e decisão

Rastrear a leitura do atributo de célula, separação de campos e consumidores
nativos de `0x6d000021`, `0x6e000021`, `0x6f000021` e `0x73020021`.
Usar `0x75020021` como comparação, não como autorização para generalização.

Foram recuperados leitores, predicados, gates numéricos e um evento concreto.
Isso avança além de inventário/raycast, mas ainda não fecha os enums de estado,
seleção de geometria, entrada, direção e transições necessários ao core.
**Não foi aberta nenhuma célula, criada ponte, bike, Surf ou regra lateral.**
A regra exata `75020021` existente não foi alterada nem revalidada no emulador.

Não assumir que faltam apenas quatro classes: no PRD-014, relaxar somente6x
não conectou47→46 ou48→50 e a fronteira também inclui `01000021`.

## Fontes, endereços e ferramenta

Binários locais em `rom/extracted/{RomFS,ExeFS}` do checkout principal.
SHA-256 observados:

| Arquivo | SHA-256 |
| --- | --- |
| DllField.cro | `9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925` |
| code.bin | `b7f9ce60361f3709ed0ce879658afe10a712f7db060640fa72bba826301b7c16` |
| static.crs | `b1976b7f480ffdeaa03cc842515472a89cc6e186d58d5022f64374a3b921005c` |
| DllFieldEventSkatePipe.cro | `f3e4821db520afd3a5dd13c281a01a2d9cc70cd51d6dd37780c474f76a71f72f` |
| DllFieldEventSlopeSlip.cro | `6cd693313ec47dd8151fda2624300fcad9937e50ac5263990d010b501d3f93da` |

Offsets de **CRO são de arquivo após relocations internas**; segmento0 começa
em `0x180`. Endereços de **code.bin são VAs**, base `0x100000`, portanto uma VA
`0x403558` é lida no offset `0x303558` desse arquivo. Não somar a base do
executável a um offset CRO nem confundir segmento BSS3 com código.

Usados `CroImage` de `scripts/cro_native_abi.py` e Capstone5.0.3 já disponível
em `/tmp/events-abi-venv`. MCP Craft Anything não listou ferramentas; CLI
`craft-anything-cli` ausente. Nenhuma configuração/dependência instalada,
nenhum código da ROM executado. Os IDs N01–N09 do relatório local são notas
próprias, **não** evidence IDs de um MCP que não respondeu.

Busca inicial: palavras completas em CROs e comparações ARM de imediatos nos
segmentos text de Field/FieldEventPlayer/SlopeSlip/SkatePipe/PokeRideAction e
no executável. A busca literal não encontrou as cinco palavras nos CROs
pesquisados; isso não exclui valores calculados, Thumb ou outros caminhos.
A varredura linear do executável inclui pools/dados: cada hit é só candidato,
não uma função. Os casos abaixo foram refinados por imports e fluxo local.

## Observações: palavra, flags e consulta

| Local | Operação recuperada | Limite da conclusão |
| --- | --- | --- |
| code `0x403558`, `0x40356c`, `0x4038cc` | `LSR24`, comparação respectivamente com6d,6e,6f e retorno booleano | Prova extração da classe, não mecânica |
| code `0x403260` | Classe em `{6d,6e,61}` | Não representa toda a família6x |
| code `0x402e60` | `(word <<20) >>>20`, isto é, `word &0xfff` | Máscara bruta dos12 bits baixos |
| code `0x403b2c`, `0x403b7c` | Testam respectivamente bits0 e1 desses flags; sentinela `word==-1` ou classeff substitui flags por1 | Não é comparação com o low-byte inteiro21 |
| code `0x403af4`, tabela `0x5860e0` | Defaults `u16` por classe:6d/6e/6f/72/73/74/75→1;61→0;3d→6 | Default1 não explica o flag adicional20 das células21 |
| code `0x4dbe14` | `LDR r0,[r0,#0x148]` | Atributo corrente armazenado no modelo, não leitura direta do GR |
| code `0x4dcaec/0x4dcb64` | Consulta por posição, testa registros ativos e fallback antes do resultado | Não é uma única consulta ao grid plano |
| static.crs patch `0x19c3dc` | Importa Field segmento0/offset `0xda7b4`, arquivo `0xda934` | Seguir import de volta ao CRO, não assumir código no stub |
| Field `0xda934` | Consulta callbacks/registros e usa code `0x4d7bdc` em um ramo | Ownership exato de cada buffer ainda aberto |
| code `0x4d7bdc..0x4d7d44` | Seleciona buffers/dimensões e faz leitura `u32` limitada por bounds, incluindo `LDR [ip,index,LSL2]` em `0x4d7d00` | Ligação completa com campos serializados GR/altura não fechada |

Assim, `0021` tem bit0 e bit5 ligados. O teste do bit0 foi observado;
**o papel do bit5 `0x20` não foi recuperado**. Não chamá-lo de bike, rampa,
ponte, grama ou muro. Um `CMP #0x21` depois de `LSR24` testa classe33,
não os flags baixos33. `3d1a0006` continua sem classificação de água/Surf:
o default6 e os predicados numéricos não nomeiam o terreno.

## Condições locais por palavra

Todos os offsets de membros nesta seção são hexadecimais. Os nomes das
variáveis C++ não foram recuperados; `+0x24` e `+0x14` são bytes de contexto,
não flags de história que possam ser inventadas no save.

### 6d e 6e: exceção de estado e projeção de vetor

Field `0xe613c..0xe6220` recebe um word em `r1`. Se bit0 está ligado, retorna1
fora da exceção **classe em6d/6e/61 e contexto+0x24 em1/2**. Mesmo nessa exceção,
ainda testa bit1 e outros estados. O significado desse retorno no movimento
completo e os enums do contexto não foram fechados; não tratá-lo isoladamente
como permissão para andar.

Xrefs em Field `0x18150`, `0x64b7c/0x64b8c`, `0xe615c`, `0xe6d14/0xe6d28`
e `0xe7cd8/0xe7cec` seguem stubs para os predicados reais do executável.
O getter do word corrente é code `0x4dbe14`.

Em Field `0x64be0..0x64cdc`, o predicado6d leva ao zero de uma componente do
vetor em `+0x8`;6e leva ao zero da componente em `+0x10`. Depois são recalculados
norma e código de direção; existem checks adicionais como `+0x695` e atributo
0a. Isso prova projeção distinta por classe, **não** a condição suficiente de
travessia, nem um nome de eixo/modo de bike por mera aparência.

Em code `0x4e0a44..0x4e0a94`,6d/6e também selecionam parâmetros float a partir
do word corrente `modelo+0x148` antes de `0x4ddbf0`. Esses parâmetros não foram
promovidos a aceleração, aderência ou velocidade sem fechar os chamadores.

### 6f: evento concreto, não significado pelo nome do módulo

Um ramo em Field `0x23cd8..0x23e50` verifica:

- contexto `+0x24 ==2` e `+0x14` em `{0x0e,0x0f,0x10,0x11}`;
- query code `0x4e3fd4` não zero;
- resultados de posição/consultas geométricas e atributo6f via `0x4038cc`;
- direção calculada diferente da sentinela9 antes de construir o evento.

A chamada Field `0x23e24→stub0x1658` tem literal importado em `0x165c`:
`DllFieldEventSkatePipe`, segmento0/offset `0x13d8`, arquivo `0x1558`.
A construtora grava vtable `0x21e8`; seu typeinfo em `0x203c` aponta para
string `0x20df`, **`N5field24EventDanielSteppingStoneE`**.

O mesmo módulo contém RTTI de IceFloor, WaterFlow e KuruKuruPanel. Logo,
“SkatePipe” sozinho não prova a mecânica. Há também nomes CycleDirt/Daniel
nos tipos de ActionCmd de Field; relacioná-los aos enums e input completos é
próximo passo, não licença para implementar Mach/Acro Bike.

`DllFieldEventSlopeSlip` contém EventSlopeSlip/EventMachCycleSlopeSlip, mas
não foi provado seu vínculo às quatro palavras. A ausência de comparação
literal no módulo não prova ausência de chamadas indiretas.

### 73 e comparação75: decoder não é direção permitida

code `0x402e6c..0x402ed0` extrai a classe e retorna:

| Classe | Código |
| --- | --- |
| 75 | 1 |
| 73 | 2 |
| 72 | 3 |
| 74 | 0 |
| 7c/7a/7d/7b | 4/5/6/7 |
| demais | 9 |

Field `0xe6224..0xe6330` e `0xe8b10..0xe8b64` consomem esse resultado,
tabela tripla em `0xf346c` e transformação oposta code `0x3e990c`.
Esta lê a tabela byte `0x581c9c`: `[1,0,3,2,7,6,5,4]`, confirmada no dump.
Há comparações tanto com a direção fornecida quanto com sua oposta, além de
queries adicionais. **Não deduzir “73 libera direita/esquerda” dessa tabela.**
A relação entre normal, entrada e ação de salto precisa ser resolvida antes
de adicionar uma variante ao core. A palavra75020021 segue somente no recorte
anterior do ADR-008; não ganhou prova de ABI completa nesta investigação.

## Hipóteses não promovidas e limites

- Não apareceu um único array comprovado “classe alta→movimento permitido”.
  Foram recuperados predicados e consumidores diferentes; ausência de array
  nesta passada não prova inexistência no programa inteiro.
- O grande switch Field `0x7764c..0x77cec` recebe a entrada em `r1` e escala/zera
  vetores. A coincidência dos comparadores6d/73/75 **não** provou que r1 seja
  uma permissão de célula; sem lineage não foi promovido a dispatch nativo.
- Rampa/declive, lama, grama restrita e ponte/muro continuam hipóteses para
  os pontos concretos de119/120. Nem nomes RTTI nem os clamps decidem a camada.
- O parser plano e o ator sem contrato de altura não equivalem à consulta
  nativa selecionada por posição/registros. Não substituir essa lacuna por
  raycast maior-hit, offsets por mapa ou desbloqueio de `01000021`.

## Continuação A-087/A-088: ownership, modos e efeito no ator

A segunda passada usa os mesmos cinco SHA, reconferidos, sem executar a ROM.
Os identificadores C01–C14 do relatório local são notas próprias, não evidence
IDs do MCP. Os achados abaixo substituem apenas o estado de conhecimento;
nenhuma hipótese virou regra do core.

### Contexto identificado e fila de modos

A origem do ponteiro foi fechada, sem procurar apenas stores com mesmo offset:

1. Field `0x23cc8` lê `owner+0x164` para o contexto consultado pelo ramo6f.
2. Field `0x9dbcc..0x9dbe0` aloca `0x7ec` bytes, chama `0x1b394` e guarda o
   resultado em `owner+0x164`.
3. `0x1b394` chama a base `0xa7b08` e instala vtable `0x10723c`. Seu RTTI
   `0xfdd78` nomeia **`N5field10PlayerGridE`**. A base instala `0x10a830`,
   com RTTI **`N5field9FieldUnitE`**.
4. A base zera `+0x14` em `0xa7b40` e `+0x24` em `0xa7b5c`; inicializa
   `+0x25/+0x26` com sentinela `0x14` em `0xa7b64/0xa7b68`.

O predicado `0xe613c` ocupa slot virtual `+0x14` nas duas vtables: entradas
`0x107250/0x10a844`. Ausência de `BL` direto não significa ausência de consumidor.
Não confundir o **slot da vtable** com o **byte de estado do objeto** `+0x14`.

Field `0x88090..0x880f8` recebe modo em `r1` e argumento em `r2`. Após checks
sobre `+0x694` e sentinela de `+0x25`, grava o modo pendente em `+0x25`, argumento
em `+0x2a`, reinicia `+0x28` e `+0x26`. A variante `0xa6b18..0xa6b5c` também
agenda `+0x25`, mas marca `+0x694=1`. `0x8808c` é literal, **não** entrada da
função; usar a fronteira correta nas buscas de xrefs.

O commit de modo em `0x8e1e4..0x8e4f8` distingue `+0x24` corrente de `+0x25`
pendente. A sentinela `0x14` evita o despacho. Em `0x8e44c..0x8e47c`, o pendente
indexa pares de8 bytes da tabela `0x141fe4` (ponteiro de função-membro e ajuste
`this`). Após sucesso do callback, `0x8e494` copia `+0x25→+0x24` se
`+0x694==0`; o outro caminho usa `+0x26`. `0x8e4d0` restaura a sentinela pendente.

| Modo corrente pretendido | Callback observado | Seletor passado a code3f58c0 | code3f2e80 / comando solicitado |
| --- | --- | --- | --- |
| 1 | Field `0xa5014` | `0x1b` | ator+0x59=2 / `0x51` |
| 2 | Field `0xa4ee8` | `0x1a` | ator+0x59=3 / `0x58` |

code `0x3f2e80` apenas limita o argumento a `<0x17` e escreve em `ator+0x59`.
Esses pares provam inicializações distintas; **não fecham o enum Mach/Acro/foot**.
Ainda falta ligar o pedido de modo a bindings de input/item e ao contrato dos
seletores. Não criar fixture de bicicleta com base só nesses números.

Para `+0x14`, há um escritor concreto adicional: Field `0xa47a8..0xa47fc`
testa direção diferente de9, solicita comando `0x5d` por `0x7764c` e grava
`0x0f` em `+0x14` em `0xa47c4`; o ramo sem direção solicita `0x58` e grava0.
Isso avança a transição local, mas não nomeia todo o conjunto `0x0e..0x11`, nem
prova que sejam quatro direções. `0x75cac` também grava0/1 nesse byte; o comando
selecionado em `r1` e o estado armazenado são domínios diferentes.

**Alias rejeitado:** Field `0x3d7b0` também escreve offset `+0x164`, mas em outro
objeto, o registro de ActionCmd. A vtable `0x1097e4` tem RTTI
`ActionCmdCycleDirtMove`, não PlayerGrid. Igualdade de offset não prova ownership.

### Flag0x20: candidatos separados da palavra da célula

A busca ARM de `AND/TST/BIC/ORR #0x20` em Field/executável não fechou a linhagem
até o low12 do permission word. Dois candidatos delimitados:

- Field `0x75c60/0x75d9c` atualiza `PlayerGrid+0x20` após checks de entrada e
  `+0x695`; não está testando o bit5 da palavra de célula.
- code `0x4d8574..0x4d858c` chama `0x4d83f4`, lê um `u16` em `registro+0x1e`,
  mascara20 e desloca5. Sem ligação desse registro ao permission word, isso
  também não explica `0x0021`.

code `0x403bec` acrescenta um predicado do bit2 (`0x4`) com normalização de
sentinelas. Os setters `0x403ba4/0x403bd8` preservam, respectivamente, campos
altos ao escrever low12 e campos baixos ao escrever a classe. Nada disso fecha20.

### Consulta geométrica: registros ativos antes do fallback

Em code `0x4dcb64..0x4dccd0`, a posição é convertida por import `0x19c3b0`.
Um ramo com tag0 e contagem do registro `+0x1c4>1` usa `0x4dc22c`. O outro
seleciona lista `modelo+0x828`, quando não nula, ou registros em `modelo+0x154`:
32 ou4 registros, stride `0x1b4`, ativo `+0x1b0==1`, teste `0x3ea730` e cópia
`0x184` bytes de `registro+0x2c`. O fallback consulta o mundo por `0x19c3d8`.

Field `0xda934..0xdab30` oferece callback em `objeto+0xc8`, itera registros
ativos/tipo4 e tem dois caminhos. O direto usa buffer `registro+0xac→+0x7c`,
converte posição por `0x8b5d4`, chama code `0x4d7bdc` e escreve o word em
`resultado+0xc`/validade em `+0x180`. Outro passa por `0x68684`, recebendo posição,
origem e parâmetros float. Callbacks podem aceitar, continuar ou recusar.

Isso **não prova seleção por maior/menor altura**, nem ownership completo de GR,
seção8, buffer físico e camada. O grounding primário herdado da base não equivale
a esse contrato. `0x4dc22c`, `0x68684` e construção dos registros seguem pendentes.

### Daniel: direção e pedidos de ação, não slide deduzido

O segundo import ficou fechado: Field chamada `0x23e50→stub0x1660`, literal
`0x1664`, importa SkatePipe segmento0/offset `0x12a8`, arquivo **`0x1428`**.
Esse setter grava a direção fornecida em `evento+0x30`.

A vtable `0x21e8` liga o tick `0x12d0` aos métodos `0x14d4`, `0x1430`, `0x14ac`:

- `0x14d4` exige code `0x4e3fd4(ator)` não zero, passa `evento+0x30` a
  `0x3f483c`, manipula flag de ator800 e chama `0x3f2afc(ator,0)`.
- Solicita `0x3fae48(ator,0x62,direção)` e incrementa contador `evento+0x32`.
  `0x1430` repete a solicitação enquanto contador `<2`; ao atingir2 marca
  `evento+0x2f`. Isso não prova dois tiles nem duas translações concluídas.
- `0x14ac` limpa flag800 e chama `0x3f2afc(ator,0)`. O tick tem fases0–3,
  chamadas `0x3f82c8` e espera por `0x3f8f40`.

code `0x3fae48` chega ao import CRS literal `0x19c7c4`, Field segmento0/offset
`0x39f44`, arquivo `0x3a0c4`. Este **agenda** comando/direção em `+8/+0xa` do
controlador `ator+0x8fc`, reinicia contador e atualiza flags. Ainda falta o
consumidor que executa comando62 e seus deslocamento, colisão e duração. Logo,
“deslizar na direção da pedra” não foi aceito nem substituído por salto inventado.

### Ledges: do decoder ao resultado intermediário

A chamada direta a `0xe6224` em Field `0x64528`, dentro de `0x64410`, exige
máscara local `r6 &0x2`, igualdade entre bytes dos descritores e último argumento0.
Sucesso modifica código intermediário: `0x18/0x19→0x1d`, `0x21→0x24`, demais→5;
grava direção/vetor e limpa aquele bit. Outros flags ainda podem levar a
`0xe811c` e recusar o resultado.

No ramo de `0xe6224` com último argumento0, depois da tabela direcional há
queries code `0x4dc6d0/0x4dcaec` e teste de outro atributo pelo decoder contra9.
O ramo com argumento não zero aceita comparações com normal/oposta. Não foi
fechada a relação desse parâmetro com input, posição e ação de salto do ator.
As classes72/73/74/75 compartilham decoder e esse caminho intermediário, mas
**isso não prova a mesma transição de salto parametrizada nos quatro sentidos**.
A regra anterior75020021 permanece restrita ao ADR-008, sem generalização.

## Continuação A-090/A-091: executor recuperado, aceitação ainda aberta

Esta passada prioriza ledges sobre bike/input e comando62; flag20 e seleção
GR/altura ficam por último. São observações e derivações estáticas, não uma
execução do jogo. Classes, comandos, resultados e offsets são hexadecimais;
distâncias e limites de contador são decimais. Os limites das duas passadas
anteriores permanecem históricos; os avanços abaixo substituem a lacuna de
executor, não todos os seus gates.

### Direção normal: 73 aponta para oeste, não para leste

code `0x3f1824` e `0x4dc6d0` indexam duas tabelas de oito `i16`:

- `0x586ea4`, deltaX: `[0,0,-1,1,-1,1,-1,1]`.
- `0x586eb4`, deltaZ: `[-1,1,0,0,-1,-1,1,1]`.

Combinadas com o decoder `0x402e6c`, elas fecham a normal numérica deste ramo:

| Classe alta | Direção decodificada | Delta X/Z | Sentido no grid extraído |
| --- | --- | --- | --- |
| 75 | 1 | `(0,+1)` | Sul |
| 73 | 2 | `(-1,0)` | Oeste |
| 72 | 3 | `(+1,0)` | Leste |
| 74 | 0 | `(0,-1)` | Norte |

Isso não inventaria palavras72/74 nos mapas. No ramo seguido de `0xe6224`,
último argumento0, a direção de saída recebe a normal, após os testes da
tripla direcional e da consulta vizinha. Não confundir esse ramo com aquele
que admite comparação com a direção oposta.

**Consequência para Route123/zone52:** `73020021` não fundamenta liberar a
barreira de `x=78` ao avançar oeste→leste desde a chegada oeste. Sua normal
neste ramo é oeste. Um futuro teste de quatro sentidos deve preservar esse
caso negativo, mesmo que feche uma travessia no sentido inverso. Não prometer
que uma regra lateral nativa abrirá o corredor por52.

### Do resultado5 à alteração das posições do ator

A cadeia recuperada já ultrapassa o agendamento:

1. Field `0x645f0` copia a posição lógica `ator+0xbc`; `0x646cc` aplica os
   deltas de entrada por `0x8f3a8` antes da consulta `0x646e8→4dcaec`.
   O atributo devolvido é consultado na célula seguinte, não simplesmente
   copiado do getter corrente `modelo+0x148`.
2. `0x77310` chama `0x64410` em `0x773c0/0x774b8`. Para a tentativa normal,
   fornece resultado-base2; sucesso do ramo de ledge o transforma em5 e
   escreve direção/vetor no descritor de saída.
3. O tick de PlayerGrid chama `0xa2088` em `0x1b17c` e encaminha o resultado
   para `0xa76e0` em `0x1b128`. Com modo corrente0, um ramo seleciona
   `0xa29e0`; resultado5 chega a `0xa2aa0..0xa2abc`, solicita comando25hex
   por `0x7764c`, com a direção de saída, e grava estado `+0x14=1`.
4. O registro de comandos usa uma referência BSS representada como `0x310`
   pelo parser, não uma função nesse offset. Em `0x3ca38..0x3ca4c`, a entrada
   no deslocamento `0x94 = 0x25*4` recebe vtable `0x108fc4` e três etapas:
   **`0x41310 → 0x83028 → 0x3a0bc`**. RTTI: typeinfo `0xfe900`, nome
   `0x103d6c`, `ActionCmdJump2G16F`.
5. O consumidor real é `0x401f0`: lê comando `u16` em `controlador+8`, busca
   a entrada, usa `controlador+0xc` como etapa e chama seus ponteiros.
   Retorno1 continua;2 aguarda;3 ou fim das etapas conclui. CRS patch
   `0x19c7e4` importa Field segmento0/offset `0x40070`, arquivo `0x401f0`;
   code `0x3f852c` o chama com `ator+0x8fc`. É o controlador escrito pela fila
   `0x3a0c4`, não outro objeto com offsets iguais.
6. `0x41310` recebe direção em `controlador+0xa` e chama `0x81b3c` com
   distância2, tipo1 e limite16 para direções0–3 (`0x82220` retorna0).
   `0x81b3c` guarda origem a partir de `ator+0xe8`, calcula destino lógico
   a partir de `ator+0xbc` por `3f1824(direção,pose,2)` e o resolve por
   `0x4dc514`. O import CRS `0x19c47c` liga o offset à rotina Field `0x8f3a8`.
   `3f12d8` escreve o destino lógico em `ator+0xbc` já na inicialização.
7. `0x83028→0x83030` recupera origem/destino, incrementa contador, interpola
   X/Z e aplica offset vertical da tabela `0xf5670`. `3f179c` escreve a pose
   física em `ator+0xe8`. Ao atingir o limite, zera o offset, atualiza flags,
   chama `3f2dfc/3f37f8` e avança a etapa. `3f37f8` projeta novamente o destino
   lógico e escreve a pose física. O estágio final `0x3a0bc` retorna3.

Portanto, **há execução parametrizada por direção e distância de duas
unidades de grid nesse ramo**, não apenas um nome RTTI ou pedido de ação.
Destino lógico e pose física mudam em momentos diferentes. Limite de contador
não comprova FPS, duração em segundos ou paridade da animação no navegador.

### Por que ainda não generalizar o runtime

- `0x64410` consulta callbacks virtuais do objeto `+0x1a0` e dos quatro
  objetos `+0x1a8` do contexto global antes do ramo de ledge. Seu resultado
  ainda depende da máscara de consultas/colisões, não só da classe alta.
- A máscara `0x2` limpa por `0x64568` pertence a **esse resultado intermediário**,
  não ao permission word. code `0x4e067c→0x4de148` combina footprint e
  consultas: OR `0x2` após `4dd318` ou representação inválida; OR `0x4` após
  `3f3498`; OR `0x8` após `4dc514/3f4920`; OR `0x10` em falhas de posição.
  Não converter
  esses bits em flags baixos da célula ou em gates de NPC já reproduzidos.
- Se restarem flags, `0x645a8→0xe811c` pode recusar. Esse caminho exige
  checks do objeto global `+0x100`, inclusive byte `+0xfc8==1`, testa posições
  deslocadas e volta a `0x645f0`; o sucesso final exige máscara zero. O
  retorno padrão em `0xe84f0` é0. A correspondência integral com colisão,
  landing, atores e estado do core ainda não foi recuperada.
- Mesmo em modo0, a seleção em `0xa775c` também pode chamar `0xa5990`.
  Seu resultado5 chega a `0xa5c10..0xa5cd0`: prepara vetores, solicita
  comando **aahex** com direção9 e grava `+0x14=1`. Registro `0x3f614`,
  deslocamento `0x2a8`, vtable `0x109290`: RTTI `ActionCmdBehindJump`.
  Inicialização `0x4513c` consulta `4df9b8` e chama `0x81670`, não `0x81b3c`.
  A equivalência desse caminho e o significado do seletor global não estão
  fechados; não chamá-lo de input analógico provado só por usar vetores.

O executor de grid está identificado, mas **faltam condições completas de
entrada e aterrissagem**. Preservados runtime, parser, mapas, colisões e a
regra exata75020021 anterior. Não criar fixture de modo presumido, abrir73
para leste ou implementar só a aparência de salto.

### Modos Mach/Dirt e executor62, sem inventar input

A tabela também liga os modos1/2 às famílias nativas de comando:

| Modo/callback | Comando e registro | Vtable/typeinfo/nome RTTI |
| --- | --- | --- |
| 1 / `a5014` | 51hex; store `3d5f8`, offset144 | `109844/fecd8/104b01`: `ActionCmdCycleMachStop` |
| 2 / `a4ee8` | 58hex; store `3d77c`, offset160 | `1097fc/fecb4/104a89`: `ActionCmdCycleDirtStop` |

Isso fecha **CycleMach/CycleDirt como famílias nativas**, não o binding de
item/menu/input nem o nome comercial Acro para Dirt. O estado `+0x14=0x0f`
escrito em `0xa47c4` vem após comando5d; registro `0x3d8b0`, vtable
`0x109e60`, RTTI `ActionCmdCycleDirtWheelieJump`. Não é prova de que0e–11
sejam quatro direções ou de qual botão inicia cada estado.

Comando62hex: store `0x3d9d4` no offset `0x188`, vtable `0x10a4d0`, typeinfo
`0xff0e8`, nome `0x105a69`, **`ActionCmdCycleDirtDanielSteppingJump`**. Suas
etapas são `0x4b224 → 0x83028 → 0x3a0bc`. A inicialização passa distância1,
tipo5 e limite8 a `0x81b3c`; o atualizador comum tem ramos específicos para
esse tipo5, incluindo tabela vertical `0xf6ec4`. Assim, no caminho de grid,
o executor calcula destino a uma unidade e atualiza o salto por solicitação
aceita; não é prova de slide ilimitado ou de equivalência entre representações.

Continuam desconhecidos input/item, enum completo `+0x14`, aceitação e tempo
real da sequência Daniel. Duas solicitações do evento não garantem duas
translações concluídas ou travessia irrestrita de6f. Não implementar bike,
SteppingStone ou fixture que force estado0e–11 a partir apenas desses nomes.

## Reprodução estática

A partir da raiz do worktree, com `ROM_ROOT` apontando para `rom/extracted`
local e o ambiente Capstone já existente, o seguinte lê bytes, não os executa:

```bash
ROM_ROOT="/caminho/local/rom/extracted" /tmp/events-abi-venv/bin/python - <<'PY'
import hashlib, os
from pathlib import Path
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
from scripts.cro_native_abi import CroImage
root = Path(os.environ['ROM_ROOT'])
cs = Cs(CS_ARCH_ARM, CS_MODE_ARM)
cs.skipdata = True
sources = [
    ('RomFS/DllField.cro', 0, [(0x64be0,0x64cdc),(0xe613c,0xe6220),(0x23cd8,0x23e50)]),
    ('ExeFS/code.bin', 0x100000, [(0x403558,0x403580),(0x4038cc,0x4038e0),(0x403b2c,0x403ba4),(0x402e60,0x402ed4)]),
]
for name, base, spans in sources:
    raw = (root / name).read_bytes()
    print(name, hashlib.sha256(raw).hexdigest())
    blob = CroImage(raw).relocated() if name.endswith('.cro') else raw
    for start, end in spans:
        for row in cs.disasm(blob[start-base:end-base], start):
            print(f'{row.address:08x} {row.mnemonic:9} {row.op_str}')
dll = CroImage((root/'RomFS/DllField.cro').read_bytes())
print('evento', dll.anonymous_import_at(0x165c))
crs = CroImage((root/'RomFS/static.crs').read_bytes())
print('consulta', crs.anonymous_import_at(0x19c3dc))
PY
```

Conferir os SHA da tabela antes de reutilizar offsets em outra ROM. O dump
mostra pools de literais como instruções; isso não transforma esses dados em
código. Para reproduzir RTTI, ler o typeinfo em `vtable-4` e o nome em
`typeinfo+4` depois de `CroImage.relocated()` no CRO de destino.

Para reproduzir ownership, callbacks, imports e efeito da continuação, usar
os mesmos `ROM_ROOT` e ambiente, sem depender dos helpers privados:

```bash
ROM_ROOT="/caminho/local/rom/extracted" /tmp/events-abi-venv/bin/python - <<'PY'
import os, struct
from pathlib import Path
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
from scripts.cro_native_abi import CroImage
root = Path(os.environ['ROM_ROOT'])
images = {name: CroImage((root/'RomFS'/f'{name}.cro').read_bytes())
          for name in ['DllField', 'DllFieldEventSkatePipe']}
images['static'] = CroImage((root/'RomFS/static.crs').read_bytes())
field = images['DllField'].relocated()
u32 = lambda blob, pos: struct.unpack_from('<I', blob, pos)[0]
for vt, expected in [(0x10723c, b'N5field10PlayerGridE'),
                     (0x10a830, b'N5field9FieldUnitE')]:
    info = u32(field, vt-4)
    pos = u32(field, info+4)
    name = field[pos:field.index(0, pos)]
    assert name == expected, (hex(vt), name)
    print('RTTI', hex(vt), hex(info), name.decode())
assert [u32(field, p) for p in [0x107250, 0x10a844]] == [0xe613c]*2
assert [u32(field, 0x141fe4+8*n) for n in [1, 2]] == [0xa5014, 0xa4ee8]
for image, patch in [('DllField', 0x1664), ('static', 0x19c7c4)]:
    print('import', image, hex(patch), images[image].anonymous_import_at(patch))
cs = Cs(CS_ARCH_ARM, CS_MODE_ARM)
cs.skipdata = True
for module, spans in [
    ('DllField', [(0x9dbcc,0x9dbe4),(0x1b394,0x1b3c4),
                  (0xa7b08,0xa7b7c),(0x88090,0x880fc),
                  (0x8e44c,0x8e4fc),(0xa4ee8,0xa5138),
                  (0xa47a8,0xa4804),(0x644f4,0x645d8),
                  (0xda934,0xdab30),(0x3a0c4,0x3a12c)]),
    ('DllFieldEventSkatePipe', [(0x12d0,0x1428),(0x1428,0x1558)]),
]:
    blob = images[module].relocated()
    for start, end in spans:
        print(module, hex(start), hex(end))
        for row in cs.disasm(blob[start:end], start):
            print(f'{row.address:08x} {row.mnemonic:9} {row.op_str}')
PY
```

Para conferir direção, registro e parâmetros dos executores A-090/A-091:

```bash
ROM_ROOT="/caminho/local/rom/extracted" /tmp/events-abi-venv/bin/python - <<'PY'
import hashlib, os, re, struct
from pathlib import Path
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
from scripts.cro_native_abi import CroImage
root = Path(os.environ['ROM_ROOT'])
for name in ['DllField.cro', 'static.crs', 'DllFieldEventSkatePipe.cro',
             'DllFieldEventSlopeSlip.cro']:
    print(name, hashlib.sha256((root/'RomFS'/name).read_bytes()).hexdigest())
code = (root/'ExeFS/code.bin').read_bytes()
print('code.bin', hashlib.sha256(code).hexdigest())
assert struct.unpack_from('<8h', code, 0x486ea4) == (0,0,-1,1,-1,1,-1,1)
assert struct.unpack_from('<8h', code, 0x486eb4) == (-1,1,0,0,-1,-1,1,1)
field = CroImage((root/'RomFS/DllField.cro').read_bytes()).relocated()
u32 = lambda pos: struct.unpack_from('<I', field, pos)[0]
for vt, expected in [
    (0x108fc4, b'N5field6mmodel18ActionCmdJump2G16FE'),
    (0x109844, b'N5field6mmodel22ActionCmdCycleMachStopE'),
    (0x1097fc, b'N5field6mmodel22ActionCmdCycleDirtStopE'),
    (0x109e60, b'N5field6mmodel29ActionCmdCycleDirtWheelieJumpE'),
    (0x10a4d0, b'N5field6mmodel36ActionCmdCycleDirtDanielSteppingJumpE'),
    (0x109290, b'N5field6mmodel19ActionCmdBehindJumpE'),
]:
    pos = u32(u32(vt-4)+4)
    assert field[pos:field.index(0, pos)] == expected
    print('RTTI', hex(vt), expected.decode())
crs = CroImage((root/'RomFS/static.crs').read_bytes())
for patch, offset in [(0x19c7e4,0x40070), (0x19c47c,0x8f228)]:
    assert crs.anonymous_import_at(patch) == ('DllField',0,offset)
    print('import', hex(patch), hex(offset+0x180))
cs = Cs(CS_ARCH_ARM, CS_MODE_ARM)
for addr, value in [(0x3ca38,0x108fc4), (0x3ca3c,0x41310),
                    (0x3c8f8,0x83028), (0x3c1bc,0x3a0bc),
                    (0x3d9bc,0x10a4d0), (0x3d9c0,0x4b224),
                    (0x3d5e4,0x109844), (0x3d768,0x1097fc)]:
    row = next(cs.disasm(field[addr:addr+4], addr))
    match = re.search(r'\[pc, #(-?0x[\da-f]+|-?\d+)\]', row.op_str)
    assert row.mnemonic == 'ldr' and match
    assert u32(addr+8+int(match[1],0)) == value
for addr, mnemonic, operands in [
    (0x3ca4c, 'str', 'r0,[r7,#0x94]'),
    (0x3d5f8, 'str', 'r0,[r1,#0x144]'),
    (0x3d77c, 'str', 'r0,[r1,#0x160]'),
    (0x3d9d4, 'str', 'r0,[r1,#0x188]'),
    (0x4134c, 'mov', 'r2,#2'), (0x41348, 'mov', 'r3,#1'),
    (0x4b248, 'mov', 'r2,#1'), (0x4b244, 'mov', 'r3,#5'),
    (0x4b238, 'mov', 'r0,#8'),
]:
    row = next(cs.disasm(field[addr:addr+4], addr))
    assert (row.mnemonic,row.op_str.replace(' ','')) == (mnemonic,operands)
print('Direções, imports, RTTI, registros e parâmetros confirmados')
PY
```

Os asserts conferem bytes e ligações, não simulam o jogo nem substituem a
análise dos gates. O patch de import fica no literal `stub+4`, não no início
da instrução `B/BL`; passar `0x19c478` como patch dá falso negativo.

Artefatos locais, não versionados: `/tmp/native-permissions-{scan,xrefs,findings}.json`,
`/tmp/native-permissions-continuation.json`, `/tmp/native-state-writers.json` e
helpers `/tmp/native-query.py`, `/tmp/native-state-writers.py`,
`/tmp/dump-native-permissions.py`. O relatório inicial separa N01–N09; o segundo
registra candidatos, aliases rejeitados e limites C01–C14. SHA, offsets,
procedimento e conclusões versionados aqui não dependem da permanência de `/tmp`.

## Verificação e próximo passo

- Passada inicial:356 Vitest/54 arquivos,176 Python sem skips e build passaram.
- Continuação sobre3013f14: `npm test && npm run build` passou com
  **362 testes/56 arquivos**, com warning herdado de chunks grandes.
- `GLB_MAPS_DIR` apontando aos assets locais do principal:
  `python3 -B -m unittest discover -s scripts -p 'test_*.py'` passou com
  **186 testes, sem skips**. Os testes extras são herdados da base integrada,
  não regressões criadas por esta entrega documental.
- As11 regressões do PRD-014 preservam barreiras, contatos e fixture670.
  **Não são red-green de uma nova mecânica**, pois não houve implementação.
- Nenhum Playwright novo, emulador ou execução dos CROs nesta entrega estática.
  O aceite parcial anterior e suas22 capturas não são reclassificados como
  evidência nativa/visual desta frente. Não foi necessária janela na main.

- A-090/A-091 sobre28113e3: **362 Vitest/56 arquivos,186 Python sem skips e
  build passaram novamente**, com avisos herdados AMX/bundle. A receita nova
  confirmou cinco SHA, seis RTTI, dois imports, registros e parâmetros dos
  executores. Somente documentação; nenhum teste novo ou aceite visual alegado.

**P-017, dono core/engine, aberta:** executor25 de duas unidades no ramo de
grid e executor62 de uma unidade foram recuperados, assim como as famílias
CycleMach/CycleDirt dos modos1/2. Isso não fecha uma regra implementável.

1. Primeiro, fechar seletor global/`+0xfc8`, callbacks e máscara de aceitação,
   posições de origem/landing e caminho `aa→4513c→4df9b8/81670`. Não confundir
   o executor25 compartilhado com equivalência de todos os ramos, inclusive
   resultados1d/24. Preservar o negativo oeste→leste para73 em52.
2. Depois, ligar modos1/2 a input/item, recuperar todo o enum `+0x14` e os
   gates/completion da sequência Daniel; não inferir duas travessias de6f
   do contador de pedidos ou do limite do atualizador.
3. Por último, retomar flag20 e seleção GR/altura, sem inventar política de
   sobreposição. Barreira01000021 e clock/gear permanecem sem contrato completo.

Só depois de uma regra completa: teste falhando, menor implementação e
Playwright visível com estado explícito equivalente. Corredor conectado,
Surf/bike, multicamada e paridade permanecem abertos.

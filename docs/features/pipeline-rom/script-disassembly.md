# Disassembly e dispatch de scripts ORAS

Continuação de [script-format.md](script-format.md), em 2026-11-17.
Escopo inicial: Fase 1/P-013. A continuação abaixo inclui o primeiro runner
puro da Fase 2, ainda sem integração ao comportamento ativo do jogo.

## Estado atual: todas as zonas e primeiro runner

Continuação em 2026-11-17, Fases 1–2/P-013 e core-jogo/PRD-002/RF-04.

- Geração `--all`: **536 zonas + 85 globais**, 1.157 programas, 530.246
  instruções, 82 opcodes e **615/615 nomes nativos resolvidos por strings locais**.
- Os vínculos agora são construídos diretamente dos bytes do sec1 por
  `zone_script_entities.py`; o JSON do checkout principal só fornece nome,
  proveniência e uma conferência independente dos IDs/counts.
- 4.149 referências: 2.892 com candidato único, 584 ambíguas e 673 sem case
  estático correspondente. Nenhum candidato é escolhido por conveniência.
- As zonas contêm `bindingSource: ZO-sec1` e `warpBindings`; os 85 globais
  incluem `bindings` inversos com zona, entidade, ID e target. A ausência de
  referência a um global é representada por lista vazia.
- Os **911 warps não possuem campo de script** no layout sec1: registram
  destinationMap/destinationTile e parâmetros de transição, com `scriptId: null`
  e status `navigation-no-script-field`. Não se confunde destinationMap com
  ID de evento. IDs de scripts calculados dinamicamente continuam fora do mapa
  estático; as 673 referências não resolvidas não são descartadas.

### Hash c34ad2ab resolvido

O nome é **MdlSetVisible**. Em `DllField.cro` (SHA-256
`9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925`),
a string `BuildMdlSetVisible\0` começa em 1097300; o sufixo `MdlSetVisible\0`
começa em **1097305** e produz exatamente o hash GF `c34ad2ab`.
A string C pode começar no meio de outra string: exigir fronteira não alfanumérica
antes do nome era incorreto para um pool com sufixos compartilhados.
O resolver agora examina todos os sufixos terminados em zero, conserva
source/offset/SHA-256 e rejeita colisões de nomes no corpus pesquisado.
Isso também resolveu os antigos nomes comunitários diretamente nos binários.

Como corroborante contextual, zona 223/sec1 em offset de código 656 chama
esse hash com duas células, empilhadas como `0,255`; global 63 em 6492/7592
usa pares `0,255`/`1,255`. Isso é compatível com esconder/mostrar um modelo,
mas não substitui uma validação runtime da ABI. A fixture sintética
`BuildMdlSetVisible\0` reproduz a falha do resolver anterior.

### Runner puro: contrato normalizado, não VM AMX

`src/core/scriptRunner.ts`, `scriptTypes.ts` e `scriptNatives.ts` implementam
um executor determinístico e imutável de `ScriptCommand[]`, sem I/O,
DOM, Three.js, relógio ou dependências novas. [ADR-002](../core-jogo/adrs/ADR-002-runner-puro-de-chamadas-normalizadas.md)
registra a decisão e seus limites. O estado contém pc, zona, atores, texto e
status; o chamador fornece textos e destinos de warp já resolvidos.

**Não se passa o JSON de disassembly diretamente para esse runner.** A VM,
a pilha de células, resolução de ponteiros de texto, ABI e conversão de
coordenadas/ACMD ainda precisam de adaptador validado. A abertura original
não foi integrada nem declarada reproduzida. Os argumentos abaixo são o
contrato local normalizado, não assinaturas comprovadas das nativas da ROM.

| Nome suportado | Argumentos normalizados | Efeito no core |
| --- | --- | --- |
| `CommandNOP` | nenhum | Sem efeito explícito |
| `MdlSetGPos` | actorId, x, y, z | Reposiciona NPC/player |
| `MdlSetDirDisp` | actorId, direção 0–3 | Atualiza direção local |
| `MdlSetVisible` | actorId, booleano 0/1 | Atualiza visibilidade |
| `TalkMdlMsg_Seq` | textId | Abre texto fornecido em `context.texts` |
| `MsgWinAllClose` | nenhum | Fecha o texto |
| `_ABKeyWait` | nenhum | Pausa até `resumeScript` |
| `_Suspend` | ticks inteiros não negativos | Pausa até ticks fornecidos pelo chamador |
| `WarpSetID` | zoneId, warpId | Move player ao destino `context.warps[zoneId:warpId]` |

O ator 255 é a convenção **desse contrato** para player. Posições e direções
já devem estar normalizadas pelo chamador; nenhuma unidade ROM é adivinhada.
`jump` usa índice de comando validado e `stop` encerra explicitamente.
`runScript` executa até pausa/término, com orçamento finito; `resumeScript`
retoma sem I/O. PC fora do programa não é término silencioso.

Uma nativa desconhecida lança `UnsupportedScriptNativeError` com seu nome,
inclusive `MdlAcmdSet` e qualquer comando não listado. Aridade, números não
finitos, ator/texto/warp ausentes e salto inválido falham explicitamente;
loop excedido falha com `ScriptExecutionLimitError` na mensagem. A sequência
sintética dos testes move NPC/player, mostra texto, pausa, fecha e faz warp.

Verificação desta continuação: 44 testes Python, 39 Vitest e build canônico;
sete testes novos do runner, sem ROM nem WebGL. A geração completa foi
repetida e comparada byte a byte antes do commit. Os números do slice abaixo
são o registro histórico da etapa anterior, não o limite da entrega atual.

## Entrega verificada — histórico do slice

- [Disassembler](../../../scripts/amx_disassembly.py) próprio para Pawn/AMX v10,
  com instruções packed, operandos, targets relativos e tabelas de switch.
- [Gerador](../../../scripts/disassemble_zone_scripts.py) reproduzível e
  independente de XAMX/pk3DS em execução; ambos serviram como referências.
- [Dados do slice](../../../src/data/zone_scripts/0006.json): zonas 6, 7, 23,
  223–231 (Littleroot, Oldale, Route 101 e respectivos interiores).
- Oito programas globais referenciados: entradas 15, 43, 47, 57, 60, 63, 66 e
  69 de `a/0/2/9`, em `src/data/zone_scripts/global_NNNN.json`.
- 28.507 instruções, 71 opcodes observados e 205 hashes nativos distintos
  nesses 32 programas (24 locais e oito globais).
- 204/205 nomes nativos resolvidos: 198 por string nos binários locais e seis
  por candidato comunitário com hash exato; `c34ad2ab` permanece desconhecido.
- 119 referências de furniture/NPC/trigger: 108 correspondências únicas,
  11 ambiguidades explícitas e nenhuma referência sem candidato.

Além da geração do slice, a validação estrutural percorreu os 1.072 programas
locais: 393.578 instruções, sem opcode desconhecido, target fora de uma
fronteira de instrução ou switch apontando para algo diferente de `casetbl`.
Os 85 globais também foram decodificados em memória para selecionar os oito
referenciados. Não foram gerados centenas de JSONs versionados sem necessidade.

## Formato dos JSONs

Cada zona contém `zoneId`, `zoneName`, origem/hash do JSON de entidades,
`bindings` e dois `programs` (`entities` = blob do sec1; `map` = sec2).
Cada programa registra SHA-256 do AMX original, entry point, tamanho dos dados,
inícios `proc`, hashes nativos em ordem de índice, dispatch e instruções.
Os dados iniciais completos não são duplicados nesses arquivos.

Uma instrução contém:

```json
{"offset": 9972, "opcode": 49, "mnemonic": "call", "operands": [-9132], "size": 8, "target": 840}
```

Todos os offsets/targets são **bytes relativos ao início do código expandido**,
não offsets físicos do arquivo compactado. `operands` usa sinal de 32 bits
(16 no imediato packed). O hash é hexadecimal sem `0x`. Uma chamada nativa
inclui índice, hash, nome ou `null`, tipo de evidência e `argumentBytes` quando
for `sysreq.n`. O índice nativo é local ao programa, nunca um opcode global.

[opcode-catalog.json](../../../src/data/zone_scripts/opcode-catalog.json)
registra todos os 71 opcodes do slice com mnemônico, tamanho dos operandos,
flag packed e frequência. [native-catalog.json](../../../src/data/zone_scripts/native-catalog.json)
registra os 205 hashes com evidência de origem, offset e SHA-256 do binário
que contém o nome, quando aplicável. `global:0015` nos vínculos referencia
`global_0015.json`, por exemplo.

## Opcode → significado

O conjunto é Pawn 3.x/v10, não o conjunto reorganizado de Pawn v11.
Nomes e formatos estão em [amx_opcodes.py](../../../scripts/amx_opcodes.py).
Esta tabela agrupa os opcodes observados; o catálogo JSON dá cada entrada
individualmente.

| Opcode(s) hex | Mnemônico(s) | Semântica VM |
| --- | --- | --- |
| `09` | `load.i` | Carrega indiretamente em PRI |
| `0B`, `0C` | `const.pri`, `const.alt` | Constante em registrador |
| `0E` | `addr.alt` | Endereço de variável local em ALT |
| `17` | `stor.i` | Escrita indireta |
| `1F`, `20` | `lctrl`, `sctrl` | Leitura/escrita de registrador de controle |
| `21`, `22`, `23` | `move.pri`, `move.alt`, `xchg` | Move/troca PRI e ALT |
| `24`, `25`, `2B` | `push.pri`, `push.alt`, `pop.alt` | Operações de pilha |
| `27` | `push.c` | Empilha constante, operando em célula adicional |
| `2E`, `30` | `proc`, `retn` | Prólogo e retorno com limpeza de argumentos |
| `31` | `call` | Chamada relativa ao opcode |
| `33` | `jump` | Salto incondicional relativo |
| `35`, `36` | `jzer`, `jnz` | Salto se PRI zero/não zero |
| `37`, `38` | `jeq`, `jneq` | Salto por igualdade/desigualdade |
| `3D`–`40` | `jsless`, `jsleq`, `jsgrtr`, `jsgeq` | Comparações com sinal |
| `4A` | `sdiv.alt` | Divisão com sinal na ordem ALT/PRI |
| `4E`, `50` | `add`, `sub.alt` | Soma e subtração na ordem alternativa |
| `51`, `52` | `and`, `or` | Operações bit a bit |
| `57` | `add.c` | Soma constante |
| `59`, `5A` | `zero.pri`, `zero.alt` | Zera registrador |
| `60`, `69` | `neq`, `eq.c.pri` | Comparação, resultado booleano |
| `75`, `77` | `movs`, `fill` | Cópia/preenchimento de memória |
| `78` | `halt` | Interrompe execução VM |
| `81`, `82` | `switch`, `casetbl` | Dispatch e tabela de casos |
| `87` | `sysreq.n` | Chamada nativa por índice + bytes de argumentos |
| `8A`, `8E`, `92`, `96` | `push2.c`–`push5.c` | Empilha múltiplas constantes |
| `9B` | `load.s.both` | Carrega duas variáveis locais em PRI/ALT |
| `9D` | `const.s` | Escreve constante em variável local |
| `A2` | `load.p.pri` | Carrega variável global, offset packed |
| `A4`, `A5` | `load.p.s.pri`, `load.p.s.alt` | Carrega variável local, offset packed |
| `AB`, `AC` | `const.p.pri`, `const.p.alt` | Constante packed |
| `AD`, `AE` | `addr.p.pri`, `addr.p.alt` | Endereço local packed |
| `AF` | `stor.p.pri` | Escrita global, offset packed |
| `B1` | `stor.p.s.pri` | Escrita local, offset packed |
| `B8`, `B9` | `lidx.p.b`, `idxaddr.p.b` | Índice escalado: leitura/endereço |
| `BC`, `BD`, `BE` | `push.p.c`, `push.p`, `push.p.s` | Empilha constante/global/local packed |
| `BF` | `stack.p` | Ajusta stack com imediato com sinal |
| `C5`, `C6` | `add.p.c`, `smul.p.c` | Soma/multiplicação por constante packed |
| `C7`, `C8` | `zero.p`, `zero.p.s` | Zera global/local packed |
| `C9` | `eq.p.c.pri` | Compara PRI com constante packed |
| `CC` | `inc.p.s` | Incrementa variável local |
| `D2`, `D4` | `halt.p`, `push.p.adr` | Halt/endereço local com imediato packed |

Packed significa opcode nos 16 bits baixos e imediato com sinal nos altos.
`0xFFFC00BF`, por exemplo, é uma única instrução `stack.p -4`.
Instruções comuns usam células adicionais para seus operandos.

### Targets e switch

Para `call`/saltos/`switch`: `target = opcodeOffset + signed(operand)`.
`casetbl` tem `opcode, count, defaultDelta, value0, delta0, ...`.
O default é relativo à célula `count`; cada delta de caso é relativo à célula
**do valor do caso**, não ao opcode nem à célula do próprio delta.
O parser valida todos os targets depois da primeira passagem.

O conjunto não observado de overlays/debug/relocação é rejeitado explicitamente,
não atravessado como células de tamanho supostamente fixo. Uma extensão futura
precisa de fixtures, não de fallback que continue após perder o alinhamento.

## Resolução de nativas

O compilador GF define `h=0; h=((h*131)^byte)&0xffffffff` para cada byte ASCII.
O gerador coleta os hashes efetivamente usados, busca nomes terminados em zero
nos `*.cro` de RomFS e em `ExeFS/code.bin` e testa igualdade exata do hash.
Não executa nem carrega esses binários. Colisões de nomes diferentes entre as
strings buscadas são rejeitadas, mas isso não prova ausência de colisões fora
desse corpus.

Seis nomes restantes são corroborados pelo catálogo XAMX, também por hash
exato: `FlagGet`, `FlagSet`, `SEPlay`, `ReserveScript`, `WorkSet`, `MdlAcmdSet`.
O gerador não baixa referências nem instala ferramentas durante sua execução.

Exemplos de nomes resolvidos (a intenção sugerida pelo nome não é validação
runtime do efeito ou da assinatura):

| Hash | Nome | Evidência |
| --- | --- | --- |
| `590f52ee` | `CommandNOP` | `DllField.cro+1094811` |
| `ebd459b9` | `WarpSetID` | `DllField.cro+1094705` |
| `4114a564` | `MdlSetGPos` | `DllField.cro+1104729` |
| `8e50f765` | `WorkGet` | `DllField.cro+1105508` |
| `accbbbd7` | `FlagReset` | `DllField.cro+1105984` |
| `30191933` | `_CallPoke3Select` | `code.bin+5120893` |
| `7b2fec69` | `_FadeRequestIn` | `code.bin+5120040` |
| `0b13a389` | `_Suspend` | `code.bin+5127052` |
| `133daa6a` | `FlagGet` | Nome comunitário + hash |
| `13413496` | `FlagSet` | Nome comunitário + hash |
| `f0882c66` | `MdlAcmdSet` | Nome comunitário + hash |
| `c34ad2ab` | desconhecido | Preservado com `name: null` |

Os argumentos são empilhados pelo chamador; `argumentBytes/4` informa quantas
células são removidas por `sysreq.n`, não os tipos ou significado dos parâmetros.
Não foram inventados rótulos de cutscene, nomes de NPCs ou efeitos de comandos.

## Vínculo entidade → script

Antes de associar IDs, o gerador confere os counts e todos os campos `script`
de furniture/NPC/triggers/triggers2, mais os IDs dos NPCs, diretamente no sec1.
Um JSON desatualizado ou de outra zona é rejeitado. A origem fica identificada
por nome e SHA-256, sem copiar o catálogo inteiro de entidades para a saída.

Nos 1.072 programas locais, o main tem o padrão:

```text
proc
load.p.pri <endereço de variável pública>
switch <tabela de casos>
```

A variável seletora exportada tem hash `d7477c97`. A associação é a igualdade
entre `entity.script` e o **valor** de um case, não índice de `publics`, índice
de função, offset em bytes ou índice nativo. O gerador exige que o endereço
carregado seja de fato uma variável pública exportada.

Cada vínculo registra programa, target do case e, quando há o padrão exato
`push 0; call function; jump exit`, o target da função chamada. Não percorre
código arbitrário fingindo recuperar o fluxo completo da história.

Exemplos observados, offsets decimais relativos ao código expandido:

| Entidade | Script ID | Programa | Case target | Função chamada |
| --- | ---: | --- | ---: | ---: |
| Zona 6, NPC id 0 | 14 | `map` (sec2) | 3968 | 9952 |
| Zona 6, NPC id 3 | 2000 | `global:0015` | 2828 | 3104 |
| Zona 223, NPC id 1 | 10591 | `global:0047` | 7168 | 42928 |

Na função 9952 da zona 6, o código empilha `-1,1,6,12` e chama a função 840;
os valores são evidência estática, não nomes inferidos de argumentos.

### Scripts globais e ambiguidades

Os 63 vínculos inicialmente sem case local encontram cases exatos nos oito
programas globais. Por exemplo, `a/0/2/9[15]` cobre IDs 2000–2006, `[47]`
cobre 10580–10604 e `[57]` cobre 10250. Isso explica referências antes vistas
como números fora das tabelas locais; não significa que `ScriptFile @0x18`
seja um índice direto desse GARC.

Permanecem 11 vínculos ambíguos: IDs baixos coincidem nos dispatches dos dois
programas locais. O sec1 tem cases `-1,0,1,2` no slice, compatíveis com callbacks
de ciclo de vida; o sec2 tem os eventos de interação. Dar preferência ao sec2
é uma **hipótese** plausível, mas o JSON preserva as duas alternativas até
confirmar a seleção feita pelo runtime. Um case encontrado não prova por si
só que o jogo nativo roteia aquela entidade para aquele programa.

A seleção automática dos globais considera IDs sem candidato local no conjunto
de zonas solicitado. Não é uma implementação do roteador de eventos do jogo.

## Reprodução e testes

Defina `CHECKOUT` como o checkout original que contém a ROM e o catálogo de
entidades (não este worktree, que começou sem esses arquivos ignorados).

```bash
python3 -B -m scripts.disassemble_zone_scripts --all \
  --zones "$CHECKOUT/rom/extracted/garc/a_0_1_3" \
  --zone-data "$CHECKOUT/src/data/zones" \
  --romfs "$CHECKOUT/rom/extracted/RomFS"
```

`--all` processa todas as 536 zonas e **todas as 85 entradas globais**, inclusive
as não referenciadas estaticamente. Sem `--all`, `--zone-ids` seleciona um
subconjunto e apenas globais referenciados; use um `--out` separado para não
misturar esse catálogo parcial com a entrega completa. `--out` troca o destino. O gerador lê também
`ExeFS/code.bin`, ao lado de `RomFS`, para resolver as nativas do executável.
Saídas não contêm timestamps, caminhos absolutos nem binários originais.

```bash
python3 -B -m unittest scripts/test_amx_disassembly.py \
  scripts/test_zone_script_bindings.py scripts/test_zone_scripts.py scripts/test_pipeline.py
npm install
npm test && npm run build
```

Verificado: 40 testes Python (22 novos + 18 anteriores), 32 testes Vitest e
build TypeScript/Vite passando. Fixtures novas são sintéticas, sem ROM,
WebGL, rede, XAMX ou pk3DS. A suíte reproduz importação ausente antes da
implementação e agora cobre packed com sinal, targets, switches, nativas,
GARC em memória, JSON de entidade divergente e colisão de dispatch.
O build mantém o aviso herdado de bundle acima de 500 KB; `npm install`
reporta nove vulnerabilidades herdadas, sem atualização de dependências
neste trabalho (P-015).

## Próximos passos de P-013

1. Validar assinaturas/efeitos das nativas no runtime/emulador e construir
   o adaptador da VM AMX para o contrato normalizado do runner puro.
2. Confirmar os 584 vínculos ambíguos e resolver os 673 sem case estático,
   incluindo regras de IDs dinâmicos, callbacks e seleção global.
3. Tipar ACMD e demais dados, integrar eventos da abertura e o renderer,
   levantar flags/eventos e verificar paridade com o jogo original.

## Referências e revisão

- [XAMX](https://github.com/BlastSlimey/XAMX), revisão
  `de428d1e9aaa383239eceb3943879ff3e25336d0`: `opcodes.txt`, `commands.txt`,
  exemplo comentado `examples/xy_map_script_13.xamx` e `what to find where.md`.
- [gf-pawncc](https://github.com/SciresM/gf-pawncc), revisão
  `54c45cbd56bdfc433aa3039efd45067e1c472cfe`: `compiler/sc6.c`
  (`hashStr`, `do_call`, `do_jump`, `do_case`, tabela de instruções).
- [Header Pawn v10](https://github.com/compuphase/pawn/blob/b0cd23fbc91501e463d6ab428e4736e28c426cf4/amx/amx.h).
- pk3DS, revisão `6daaca934ca2284a73ab743bf89c848c57cd9de1`, para layout
  de entidades; nenhum binário dessas ferramentas foi executado.

# Scripts de zona ORAS: Pawn/AMX v10

Investigação estática em 2026-11-17, Fase 1/P-013. O envelope binário e a
compactação estão decodificados; a API nativa de eventos ainda não está.
Nenhum programa da ROM foi executado e nenhum conversor 3D foi usado.

## Resultado e cobertura

Os scripts são programas **Pawn/AMX de 32 bits, versão 10**, com nomes de
símbolos substituídos por identificadores/hash no fork da Game Freak.
Não são uma sequência de opcodes NDS nem apenas uma tabela de ponteiros.
Há código, dados iniciais e tabelas de símbolos no mesmo programa.

Evidências observadas nos arquivos locais (ROM USA Rev 2):

| Origem | Programas | Conteúdos distintos, sem padding | Células de código + dados |
| --- | ---: | ---: | ---: |
| `ZO sec1`, depois das entidades | 536 | 162 | 53.213 |
| `ZO sec2`, script de mapa | 536 | 331 | 533.470 |
| Entradas GARC `RomFS/a/0/2/9` | 85 | 85 | 209.873 |

Os 1.157 programas apresentam `magic=F1E0`, versões `10/10`,
`flags=001C`, `defsize=8`. A expansão consumiu exatamente `size-cod` bytes
em todos e produziu exatamente `(hea-cod)/4` células. Total: 796.556 células,
sendo 770.780 de código e 25.776 de dados. Os tamanhos físicos sem padding
variam de 149 a 29.082 bytes. Há 577 programas distintos entre as três fontes.
Padding observado: 0/1/2/3 bytes zero em 258/133/474/292 programas.

A rotina do pk3DS (`QuickDecompress`) e o leitor do FireyFly corroboram a
compactação. O header AMX v10 e a documentação de `gf-pawncc-ctr` explicam
os campos e os hashes; não se inferiu Pawn apenas pela assinatura.

## Localização dentro do ZO

O mini-container começa com `ZO`, `u16 sectionCount=5` e seis offsets `u32`
little-endian em `0x04`: cinco inícios e o fim do arquivo. O primeiro é `0x1C`.

Na seção 1, calcule o começo do AMX a partir dos counts:

```text
scriptOffset = 12 + furnitureCount*0x14 + npcCount*0x30
                 + (warpCount + trigger1Count + trigger2Count)*0x18
```

Nos 536 arquivos esse offset também é `u32(sec1, 0)+4`. O primeiro `u32`
do AMX é seu tamanho **incluindo esse próprio campo**, não um prefixo externo
seguido por outro header. Após `size` há apenas padding até múltiplo de quatro.
A seção 2 já começa diretamente com outro AMX.

## Header AMX

Offsets relativos ao primeiro byte do AMX, inteiros little-endian:

| Offset | Tipo | Campo | Significado |
| --- | --- | --- | --- |
| `00` | u32 | size | Tamanho físico compactado, incluindo header/tabelas |
| `04` | u16 | magic | `F1E0`: células de 32 bits |
| `06` | u8 | file_version | `0A` |
| `07` | u8 | amx_version | `0A` |
| `08` | u16 | flags | `001C` observado; não é offset |
| `0A` | u16 | defsize | `0008`: tamanho de registro, não quantidade de ponteiros |
| `0C` | u32 | cod | Início físico do payload; início lógico do código |
| `10` | u32 | dat | Início lógico dos dados após expansão |
| `14` | u32 | hea | Fim lógico dos dados iniciais/início do heap |
| `18` | u32 | stp | Topo reservado do stack; não é tamanho físico |
| `1C` | u32 | cip | Entry point relativo ao código |
| `20` | u32 | publics | Início da tabela de funções públicas |
| `24` | u32 | natives | Início da tabela de funções nativas |
| `28` | u32 | libraries | Início da tabela de bibliotecas |
| `2C` | u32 | pubvars | Início da tabela de variáveis públicas |
| `30` | u32 | tags | Início da tabela de tags |
| `34` | u32 | nametable | Campo AMX de nomes; fork usa hashes |
| `38` | u32 | overlays | Campo AMX de overlays |

Cada tabela de definições ocupa o intervalo entre seu início e a próxima;
registros de oito bytes são `{u32 address, u32 identifier}`. O segundo campo
não deve ser seguido cegamente como ponteiro ASCII: no fork GF é um hash.
O extrator preserva ambos sem tentar resolver nomes. Os bytes de `nametable`
até `cod` são preservados como `metadataHex`; não foram interpretados.

A tabela `publics` é vazia nos 536 scripts de entidades; nos scripts de mapa
é vazia em 418 e tem um registro em 118. Logo, o campo `script` de NPC/trigger
**não pode ser assumido como índice direto de `publics`**. O dispatch do jogo
continua desconhecido.

## Compactação e instruções

Apenas `[cod,size)` está compactado. Leia grupos em ordem mais significativa
primeiro, sete bits úteis por byte. Bit 7 indica continuação; bit 6 do
**primeiro** grupo estabelece a extensão de sinal. Ao terminar o grupo,
reduza o resultado a `u32`, como faz o acumulador do pk3DS. Não use ULEB128,
SLEB128 little-endian, LZ11 ou leitura direta de `u32` sobre o payload.

Exemplos pequenos: `3F → 0000003F`, `80 40 → 00000040`, `7F → FFFFFFFF`,
`FF 3F → FFFFFFBF`, `8F FF FF FF 7F → FFFFFFFF` (wrap de 32 bits).

Expanda `(hea-cod)/4` células. Separe as primeiras `(dat-cod)/4` como código;
o restante é **dados**, que podem incluir tabelas, constantes e movimentos,
mas não são exclusivamente movimentos. `ScriptMovementStart` do pk3DS é o
campo AMX `dat`; `FinalOffset` é `hea`. Da mesma forma, a leitura conjunta
`0A0AF1E0` chamada `Magic` pelo pk3DS inclui as duas versões.

Os opcodes pertencem ao conjunto Pawn 3.x/v10, incluindo instruções packed.
Um inteiro do array `codeCells` pode ser opcode, operando ou opcode com
imediato nos 16 bits altos. Não se deve tratar cada célula como uma operação
independente. `0x2E`/`0x30` correspondem ao prólogo/retorno na referência do
pk3DS; nomes e efeitos de chamadas nativas da história não foram provados.
Não usar a enumeração de opcodes de Pawn v11: o conjunto foi reorganizado.

## Exemplos observados

Amostras curtas de header/payload, não programas completos:

```text
Zona 0000, sec1: AMX em sec1+0x4BC
0000: B2 00 00 00 E0 F1 0A 0A 1C 00 08 00 60 00 00 00
0010: 3C 01 00 00 40 01 00 00 40 11 00 00 04 00 00 00
0060: 81 52 2E 81 22 81 01 80 6C 81 3C 31 ...
```

`size=0xB2`, `cod=0x60`, `dat=0x13C`, `hea=0x140`, `stp=0x1140`.
O payload tem 82 bytes e expande para 56 células: 55 de código e uma de dados
(`FFFFFFFF`). As primeiras células são `D2 2E A2 81 6C BC 31 A0`.
O mesmo programa aparece no sec1 da zona 227 apesar das entidades diferentes.
SHA-256 sem padding:
`50c67083884939442c908628a7ec976b86668e1198f065c9f88acf3acaa58e77`.

```text
Zona 0006, sec2:
0000: 26 19 00 00 E0 F1 0A 0A 1C 00 08 00 40 02 00 00
0010: 00 2B 00 00 AC 2D 00 00 AC 3D 00 00 6C 0E 00 00
003C: A0 15 00 00 54 2D F0 63
```

Esse programa tem 6.438 bytes físicos, `cod=0x240`, `dat=0x2B00`,
`hea=0x2DAC`, `cip=0xE6C`. O único public tem endereço `0x15A0` e
identificador `0x63F02D54`. SHA-256:
`9cdc3422c051abf674bdc683c84014f38daa8b796d8a45d0e9700db22f7cc016`.

Zonas 223/225 (casas dos protagonistas) têm headers quase idênticos, mas
programas distintos: sec1 com 608/602 bytes físicos e sec2 com 785/784.
Comparar só headers ou tamanhos não prova identidade de comportamento.

## Relação com `a/0/2/9`

É um GARC de 503.244 bytes, 85 entradas, uma subentrada por entrada, cada
qual diretamente AMX (sem LZ11 observado). Todas passam o mesmo parser.
A entrada 33 é byte a byte igual ao script sec2 da zona 0 e de outras 175
zonas. As outras 84 não são cópias integrais dos 1.072 programas de zona.
Isso comprova formato compartilhado, **não** uma relação universal zona→índice.

O `ZoneData.ScriptFile @0x18` do pk3DS varia de 0 a 537 nas 536 zonas;
por exemplo zona 0 tem 524, zona 6 tem 476. Não é índice direto no GARC de
85 entradas. Investigar a resolução pelo código do jogo antes de associar
nomes de eventos ou cenas aos índices de `a/0/2/9`.

## Extração reproduzível

```bash
python3 -m unittest scripts/test_zone_scripts.py scripts/test_pipeline.py
python3 scripts/extract_zone_scripts.py \
  --zones /caminho/local/rom/extracted/garc/a_0_1_3 \
  --out rom/extracted/zones_scripts
```

O destino padrão, se `--out` for omitido, é `src/data/zones_scripts` conforme
o contrato do pipeline. Nesta investigação a saída foi deliberadamente
redirecionada para `rom/` ignorado: **nenhum arquivo de `src/` foi alterado**
e os programas completos da ROM não são commitados. Verifique
`git check-ignore -v rom/extracted/zones_scripts/0000.json` antes da geração.

Cada JSON tem `zoneId`, `entities` e `map`. Cada programa contém `header`,
`sha256` (sem padding), `tables`, `metadataHex`, `codeCells` e `dataCells`.
Arrays usam números unsigned de 32 bits; o consumidor deve aplicar sinal
somente quando o opcode exigir. O parser é estrito para o perfil observado
(flags/versões) e rejeita offsets, padding e compactação inconsistentes.
Ele não é disassembler, compilador, runner nem decodificador de cutscenes.
`parse_amx` também aceita subentradas de `a/0/2/9` já desempacotadas.

Verificação realizada: 536 JSONs/1.072 programas gerados; os 85 programas
adicionais lidos em memória e validados com `parse_amx`; 18 testes Python
passando (10 novos e 8 existentes, sem ROM). A execução canônica
`npm test && npm run build` parou em `vitest: command not found` porque este
worktree não tem `node_modules`; build não executado. Não foram instaladas
dependências para evitar carga adicional durante o batch de GRs.

## O que permanece aberto (P-013)

1. Resolver a API nativa (hash→função, argumentos e efeitos) e a ligação entre
   IDs de NPC/trigger e o dispatch AMX. Só então nomear diálogos/flags/cenas.
2. Desmontar instruções com a tabela Pawn v10 correta, incluindo packed,
   saltos relativos e tabelas de switch; validar targets e fluxo.
3. Tipar os dados/movimentos sem interpretar todo `[dat,hea)` como movimento.
4. Determinar como o jogo seleciona os 85 scripts de `a/0/2/9`.
5. Implementar runner determinístico com fixtures sintéticas e comparar com
   emulador. Nada desta etapa foi implementado no jogo.

O MCP Craft Anything não disponibilizou ferramentas nesta sessão
(`mcp_list_tools` falhou); evidências foram obtidas por leitura estática e
Python leve, sem depender desse serviço.

## Referências

- pk3DS local, commit `6daaca934ca2284a73ab743bf89c848c57cd9de1`:
  `pk3DS.Core/Structures/Script.cs`, `Scripts.cs` e
  `pk3DS.WinForms/Subforms/Gen6/Experimental/OWSEStructs.cs`.
- [Leitor de scripts do FireyFly, revisão fixa](https://github.com/FireyFly/poketools/blob/e74538a5b5e5dab1e78c1cd313c55d158f37534d/src/formats/script.c).
- [Header Pawn v10 de referência](https://github.com/compuphase/pawn/blob/b0cd23fbc91501e463d6ab428e4736e28c426cf4/amx/amx.h).
- [Discussão pk3DS sobre Pawn e opcodes 3.x](https://github.com/kwsch/pk3DS/issues/508).
- [gf-pawncc-ctr: nomes de símbolos como hashes](https://github.com/SciresM/gf-pawncc).
- [XAMX: ferramenta externa para scripts XY/ORAS/SM/USUM](https://github.com/BlastSlimey/XAMX)
  (não executada nesta investigação).

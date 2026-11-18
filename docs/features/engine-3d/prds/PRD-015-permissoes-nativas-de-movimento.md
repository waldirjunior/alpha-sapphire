# PRD-015 — Leitores e condições nativas das permissões de movimento

- **Data:** 2026-11-18.
- **Fase:** 2; P-017/P-013; A-082/A-083; continuação do PRD-014.
- **Base:** main `202d74b`, mesmo worktree `eastern-lilycove` autorizado.
- **Estado:** investigação estática entregue; **inconclusiva para implementar
  uma regra completa de movimento**. Runtime, colisões e mapas intactos.

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

Artefatos locais, não versionados: `/tmp/native-permissions-{scan,xrefs,findings}.json`
e os scripts `/tmp/native-permissions-*.py`, `/tmp/dump-native-permissions.py`.
O relatório findings separa observações N01–N09, desconhecidos e decisão.
SHA, offsets, procedimento e conclusões ficam versionados aqui para não
depender da permanência de `/tmp`.

## Verificação e próximo passo

- `npm test && npm run build`:356 testes/54 arquivos e build passam;
  warning herdado de chunks grandes permanece.
- `python3 -B -m unittest discover -s scripts -p 'test_*.py'`:176 passam,
  sem skips, com `GLB_MAPS_DIR` local configurado.
- As11 regressões do PRD-014 preservam barreiras, contatos e fixture670.
  **Não são red-green de uma nova mecânica**, pois não houve implementação.
- Nenhum Playwright novo, emulador ou execução dos CROs nesta entrega estática.
  O aceite parcial anterior e suas22 capturas não são reclassificados como
  evidência nativa/visual desta frente. Não foi necessária janela na main.

**P-017, dono core/engine, aberta:** recuperar escritores/enum de `+0x24/+0x14`,
consumidores de flag20, seleção completa GR/altura e aceitação do passo/salto.
Só depois definir teste falhando para uma condição completa, implementar a
menor regra e fazer Playwright visível com estado explícito equivalente.
Corredor conectado, Surf/bike, multicamada e paridade permanecem abertos.

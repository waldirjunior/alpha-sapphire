# ADR-006 — Altura por célula da colisão física GR

- **Status:** Aceito para a superfície física primária
- **Data:** 2026-11-18
- **Escopo:** P-017, PRD-003/PRD-005, A-080/A-081

## Evidência e decisão

A geometria visual BCH contém telhados e paredes que não são o piso ocupado.
O GR também contém uma seção `coll` independente no índice2. Nos857 GRs
inventariados, o cabeçalho e os ranges delimitam uma lista de triângulos
homogêneos float4; os846 usados pelos536 mapas passam pelo parser estrito.
A projeção X/Z, escala18 e alturas são corroboradas por geometria e ZOs nos
checkpoints; isso não recupera a ABI ou o dispatcher nativo de camadas.

O pipeline amostra o centro de cada célula na seção2, usando coordenadas
nativas `(tile−19.5)×18` e interpolação baricêntrica dos triângulos. Converte
Y para tiles e publica `groundHeights` em JSON estrutural, sem vértices ou
binários. Triângulos repetidos pelos ranges espaciais são deduplicados.
Uma célula sem hit ou com alturas distintas fica `null`; diferenças até
0.0001 tile são tolerância numérica, não escolha de piso superior/inferior.
Não se consulta nome de material, maior hit visual ou bitfield desconhecido.

O adapter valida dimensões e valores finitos/null e copia o grid. O helper
puro `groundHeight` consulta a célula local, independentemente de romOrigin e
worldOrigin. `groundedWorldPosition` combina esse Y com a projeção X/Z já
existente. Sem dado conhecido, a apresentação conserva o fallback anterior
Y0; a API de consulta continua retornando null, não um piso comprovado.

Player, NPCs e interactables usam a mesma projeção. O player estende a
interpolação exponencial de apresentação existente em X/Z para Y, com o
mesmo coeficiente18 e delta do renderer, sem segundo timer. Trocas de mapa
não contínuas continuam copiando o alvo inteiro. Isso não prova a cadência
ou a curva de interpolação originais e não implementa o hop gráfico nativo.

A câmera follow mira playerY+0.5 e usa eyeY=playerY+9. Distância, ângulo, FOV,
clipping, depth e materiais permanecem iguais. Câmeras AMX ativas continuam
soberanas e com coordenadas absolutas; battle camera não é alterada.

## Limites e validação

O escopo é a superfície física primária. A seção8 encontrada em parte dos
GRs é outra superfície física e não é fundida ao sampler. Em15(2,20), a
primária dá0 e a adicional7.5; selecionar esta última colocaria o ator
no piso errado nessa chegada. Seleção de camada, actor.y explícito e alturas de warp
em pisos secundários continuam P-017, sem inferir uma política de proximidade.

A auditoria preservou todos os campos anteriores dos536 JSONs e os índices
de vizinhos/validação. Há318424 células transitáveis com altura conhecida e
539 desconhecidas; não são promovidas por aproximação. Dos863 warps dentro
do recorte,705 concordam com ZO em tolerância0.15,25 não têm altura única e
133 diferem, incluindo pisos secundários e offsets/rampas ainda não resolvidos.

Regressões sintéticas cobrem elevação27, variação21→20.5 no mesmo GR, chão e
piso secundário sobrepostos, triângulos duplicados, vazios e dados inválidos;
Vitest cobre adapter, NPC, player e câmera. A/B visível compara código e JSONs
reais de0372885 com o fix, sem mudar assets ou executar init/campanha.
Os resultados e os casos separados de oclusão estão em
[maps-format](../../pipeline-rom/maps-format.md#grounding-pela-superfície-física-primária-a-080a-081).

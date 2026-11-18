# ADR-006 — Hide-flags e remoção persistente de atores

- **Estado:** aceito, implementação verificada em testes.
- **Data:** 2026-11-18.
- **Relacionados:** P-013/P-017, A-047/A-048,
  [PRD-009 do corredor](../../engine-3d/prds/PRD-009-corredor-rustboro-verdanturf.md).

## Contexto observado

A rota 16→43→75→11 já possui contato MM4 e portais ZO. Não falta uma borda:
o túnel é interrompido pelos atores 12/13/14 da zona 75, posições
(50,10)/(51,11)/(50,12), modelo 8204 e `spawnFlag=676`.

O programa `0075.json/programs/map`, função 6116, contém `FlagSet(676)`
na instrução 6180 e `MdlDel(12/13/14)` em 6196/6212/6228. O programa
`entities` consulta `FlagGet(676)` em 584 e altera o work 16517 quando setada.
A relação flag/remoção prova a direção de ocultação neste grupo; não autoriza
ocultar todo NPC apenas por possuir flag diferente de zero.

## Decisão

- `MdlDel(id)` passa de efeito opaco a comando de estado da VM, com uma célula
  de argumento. Remove a entrada de `world.actors` e registra um tombstone em
  `world.deletedActors["zona:id"]`. O comando é idempotente; o retorno do host
  é 0, sem simular animação ou afirmar um retorno observado do jogo original.
- O clone da VM copia os tombstones. Remoção não se confunde com
  `MdlSetVisible(false)` e não contamina outra zona que reutilize o mesmo ID.
- `amxProgress.ts` traduz flags para `storyFlags["amx:flag:id"]` e tombstones
  para `storyFlags["amx:deleted:zona:id"]`. O formato de save v1 já serializa
  esse dicionário; não há alteração dos JSONs nativos nem nova versão de save.
- O host restaura o progresso antes de construir atores e de executar init.
  Não reconstrói atores removidos. Projeta visibilidade somente se o ator não
  foi removido, não foi ocultado pela VM e sua hide-flag não está setada.
  `spawnFlag=0` não é gate, mesmo se a flag numérica 0 estiver setada.
- `gameEvents` persiste o progresso após cada execução. Quando um warp já
  mudou o mapa, persiste flags sem projetar atores ou player do mapa anterior.
  Isso evita perder um `FlagSet` posterior ao warp na entrada seguinte.

## Consequências e limites

A navegação inicial continua bloqueada. O estado pós-evento pode ser uma
fixture explícita derivada do bloco real 6176..6239, mas não equivale a jogar
a missão Peeko, obter Rock Smash ou completar o script inteiro. Um halt
sintético limita esse teste ao bloco, sem confirmar efeitos opacos anteriores.

`MdlAdd`, callbacks, work vars/party/bag no save e apresentação completa ainda
não estão implementados por esta decisão. A reativação de um ator removido
não é inferida de `FlagReset`: exige a semântica futura de criação do ator.
P-013/P-017 continuam abertas; não se declara paridade com o emulador.

## Verificação

O teste de `MdlDel` falhou antes como `await-input` e agora termina removendo
somente o ator solicitado sem mutar a origem. O bloco real da zona 75 seta
676 e remove os três IDs. Testes do host cobrem hide-flag, flag 0, reset,
visibilidade explícita, save/reload, isolamento por zona e flags após warp.

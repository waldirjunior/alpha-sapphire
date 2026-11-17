# ADR-002 — Runner puro de chamadas normalizadas

- **Estado:** aceito
- **Data:** 2026-11-17
- **Escopo:** PRD-002/RF-04, Fase 2/P-013

## Contexto

O pipeline conhece as instruções Pawn v10, os nomes nativos por hash e os
cases de dispatch. Isso ainda não define a ABI completa dos comandos,
o formato ACMD de movimento nem o roteamento runtime da ROM.

## Decisão

Implementar em `src/core/scriptRunner.ts` uma máquina determinística de
chamadas **normalizadas**, com estado imutável, saltos e término explícitos,
texto, transformação de atores, warp e esperas retomadas pelo chamador.
O contrato está em `scriptTypes.ts`; efeitos suportados em `scriptNatives.ts`.

Os nomes coincidem com nativas conhecidas, mas os argumentos desse contrato
não são as células brutas da ABI AMX. Um adaptador futuro deve validar
assinaturas, resolver referências de mensagens/atores e converter unidades.
O runner não aceita diretamente os JSONs de disassembly como programa.

Comandos desconhecidos falham com `UnsupportedScriptNativeError`, com nome
ofensor. Argumentos inválidos, referências ausentes, saltos inválidos e loops
acima do orçamento falham explicitamente. Nenhum fallback ignora comandos.
Não há relógio, aleatoriedade, I/O, Three.js ou DOM.

## Consequências e limites

O núcleo já pode ser verificado em Node por sequência sintética de movimento,
texto, espera e warp, sem ROM e sem renderizador. NPC e player usam o mesmo
contrato de ator; o ID 255 é a convenção local de player, não uma garantia
universal da ABI original.

Não é uma VM Pawn, não interpreta ACMD, não toca o estado ativo do jogo e não
reproduz automaticamente a abertura original. Integração com bytecode, eventos
e renderer, além de paridade com emulador, continuam em P-013. Os contratos e
nativas suportadas estão em
[script-disassembly.md](../../pipeline-rom/script-disassembly.md).

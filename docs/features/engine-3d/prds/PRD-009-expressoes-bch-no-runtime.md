# PRD-009 — Expressões BCH no runtime

- Estado: seleção explícita implementada e A/B validado em 2026-11-18;
  piscada automática e paridade permanecem pendentes, Fase 2/P-019.
- Base: main 4f42e54; continuação de PRD-007 e A-044/A-045.

## Resultado e fronteira

Aplicar ChangeFace ao ator identificado pelo script, usando somente os oito
frames 0/10/…/70 da paleta material extraída dos cinco GLBs corrigidos.
O core guarda estado puro; a projeção envia a expressão e o engine transforma
apenas a textura do material evidenciado, isolada por instância de ator.
Cargas assíncronas devem receber a expressão mais recente e descarte não
pode invalidar textura/material compartilhado de outro ator.

## Evidência recuperada

DllField.cro SHA 9ef39f553dfba33056f12f23051b8da1f667a5ba80c6f8f2af7a76db004bd925:
ChangeFace 0x51ac0 converte ator uint16 e expressão uint8. O lookup 0x22b0
importa static/0x4e366c, que compara o ID com o u16 no registro do ator +0xc.
O switch static/0x3f80e8 chama o getter de estado 0x4e3d8c, que consulta
actor+0xa18 com chave actor+0x96c. O stub 0x19c7a8 foi resolvido no static.crs:
import anônimo DllField, segmento0/offset0x38838, arquivo0x389b8.
Esse setter aplica s0 via vtable+0xcc ao modelo em estado+0x1fc, canal0,
e grava estado+0x27c=(frame==0). O vínculo é ao ator resolvido, não ao speaker.

O update DllField 0x38850–0x389ac usa o mesmo modelo/slot virtual: frame10,
contador fechado2, depois frame0; espera helper(60)+60 e possíveis intervalos
curtos4/8 controlados por outro byte. O clock desse update e o contrato do
helper não foram comprovados: não inventar uma temporização automática.
As leituras são estáticas, sem executar código da ROM.

## Aceite

- Regressão determinística falha no estado anterior e passa no dispatch real
  da VM, incluindo casts, fallback0 fora0..7 e ator inexistente sem efeito.
- Projeção preserva expressão do player sem mover spawn/borda; expressão do
  NPC usa identidade da entidade, não posição, speaker ou modelo.
- Material/textura clonados por ator, curvas extraídas e matriz DccMaya com
  sinal comprovado; sem mutar UV, corpo, skin ou outra instância.
- A/B Playwright de duas expressões no mesmo NPC com GLB real e chamada AMX,
  distinguindo fixture sintética de ramo natural da ROM.
- Verificação canônica e Python; documentação A-046+ e limites atualizados.
- Piscada automática fica pendente enquanto o clock/condições não forem
  comprovados; não tocar a paleta70 continuamente nem inventar frames.

## Expansão de orientação-base — A-050/A-051

Continuação sobre a0ab2ce: a guarda de oito frames pertence à expressão,
não à restauração de V. A auditoria agora inclui 99 MM e rostos/cabeças
estáticos, com identidade RGBA/dimensões e orientação comprovadas por material.
79 GLBs/91 materiais foram normalizados e publicados por hash, incluindo os
sete casos curtos das 12 paletas antigas. Novas expressões só são exportadas
quando a paleta completa observada existe; nenhuma temporização foi criada.

Os 51 MM mapeados das zonas 6–16 estão no catálogo (44 corrigidos, sete
intactos); 12 IDs especiais seguem sem remapeamento. Sete materiais de BBox
simétrica e 13 MM sem candidato nativo ficam intactos, com razões em
[character-face-coverage.json](../../pipeline-rom/character-face-coverage.json).
O validador comprova preservação estrutural/idempotência dos 99 outputs.
A/B de MM0179/MM0299/MM0221 com arquivos publicados inspecionou seis capturas,
sem editar UV no navegador e sem erros/warnings/HTTP>=400. Não é caminhada
nem paridade com emulador; 250 Vitest/build/155 Python passaram, um skip
pré-existente por assets públicos ausentes no worktree.

# ADR-008 — Ledges ao sul por permissão GR

- Data: 2026-11-18.
- Estado: aceito e verificado localmente; Playwright na main pendente.
- Contexto: Fase2/P-017 e PRD-013 da engine-3d.

## Problema e evidência

Reduzir toda palavra GR terminada em21 a colisão binária mantém os tiles de
ledge bloqueados, mas perde a ação direcional que permite atravessá-los.
Jagged84 para emz29 mesmo sem NPCs. Nos223 GRs staged, a palavra exata
0x75020021 ocorre541 vezes; seu norte é livre em todos os casos, seu sul em526.
Raycasts estáticos das geometrias mostram queda ao sul em Jagged e outras rotas:
GR291(33,30)21→20.5, GR31(26,7)2→1.5, GR72(8,18)3→2, GR78(2,28)2→1.5.
Inventário, variantes e limites estão no PRD-013. Isso é evidência estática para
a semântica derivada, não validação no emulador ou identificação da ABI nativa.

## Decisão

Extrair `southLedges` como coordenadas dos tiles cuja palavra é exatamente
0x75020021, respeitando ownership MM e origem local. Manter `collisions` e
`terrain` intactos: o tile de ledge não se torna piso livre.

O core salta atomicamente dois tiles ao sul quando há esse metadado no tile
intermediário bloqueado, não há ator visível nele e a aterrissagem é caminhável.
A subida e a entrada lateral continuam bloqueadas. Respeitar bounds, atores,
diálogo e prioridade ZO existentes. Não cruzar zonas por salto nem criar warps.
O adaptador valida/copia o metadado sem compartilhar o array com o JSON fonte.

Somente0x75020021 faz parte desta decisão. Variantes0x75000021/0x75640021 e
classes laterais0x72020021/0x73020021 permanecem bloqueadas até decisão própria;
não generalizar um bitfield direcional nem liberar todos os low bytes21.

## Verificação e limites

Regressões sintéticas cobrem descida/subida/lateral, imutabilidade, aterrissagem
bloqueada/fora dos limites, atores visíveis/ocultos, ZO coincidente e diálogo.
A composição Python deve preservar a colisão1 e mascarar a zona vizinha.
O corredor real deve atravessar84→39→9 com os NPCs nativos presentes.

Não implementar animação de hop ou altura gráfica nesta decisão. Esses efeitos,
o demo do bondinho e a campanha completa continuam distintos da passabilidade.
Ações de rede ou renderização não entram no core.

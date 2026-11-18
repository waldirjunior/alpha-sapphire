# PRDs — `engine-3d`

| ID | Título | Estado | Data |
| --- | --- | --- | --- |
| [PRD-001](PRD-001-cena-3d-e-glb-sob-demanda.md) | Cena 3D, Dados de Mapa e Carregamento de `.glb` sob Demanda | Em andamento (Fase 2) | 2026-11-16 |
| [PRD-002](PRD-002-animacoes-esqueleticas-idle-walk.md) | Animações Esqueléticas (`idle` e `walk`) sem T-Pose | Planejado (Fase 2) | 2026-11-17 |
| [PRD-003](PRD-003-fidelidade-visual-mapas-e-interiores.md) | Fidelidade Visual de Mapas, Shaders PICA200 e Interiores | Planejado (Fase 2) | 2026-11-17 |
| [PRD-004](PRD-004-interface-3ds-menus-party-bag-pokedex.md) | Interface Estilo Nintendo 3DS (Menus, Party, Bag, Pokédex) | Planejado (Fase 2–3) | 2026-11-17 |
| [PRD-005](PRD-005-mapas-de-zona-no-runtime.md) | Mapas de zona no runtime, chunks, NPCs e warps | Implementado; limites em P-017 | 2026-11-17 |
| [PRD-006](PRD-006-corredor-continuo-hoenn.md) | Corredor contínuo Littleroot–Petalburg | Validado; 500 passos Playwright na main | 2026-11-17 |
| [PRD-007](PRD-007-animacoes-nativas-no-runtime.md) | Animações GF1 no runtime e auditoria do atlas | Implementado; Playwright main validado, paridade pendente | 2026-11-17 |
| [PRD-008](PRD-008-corredor-petalburg-rustboro.md) | Corredor Petalburg–Route104–Woods–Rustboro | Validado;306 passos Playwright main sem erros | 2026-11-17 |
| [PRD-009](PRD-009-expressoes-bch-no-runtime.md) | ChangeFace e seleção de expressão BCH por ator | Seleção e A/B implementados; piscada automática pendente de clock | 2026-11-18 |
| [PRD-010](PRD-010-corredor-rustboro-verdanturf.md) | Corredor Rustboro–Route116–Rusturf–Verdanturf | Validado;325 passos main, fixture pós-evento explícita | 2026-11-18 |
| [PRD-011](PRD-011-corredor-verdanturf-mauville-slateport.md) | Verdanturf–Mauville e acesso pós-evento a Slateport | Validado;748 passos main, fixture explícita e limites de oclusão | 2026-11-18 |
| [PRD-012](PRD-012-corredor-mauville-fallarbor-meteor-falls.md) | Mauville–Fallarbor–entrada de Meteor Falls | 1023 passos main; base bloqueada/fixture derivada, loop e visual pendentes | 2026-11-18 |
| [PRD-013](PRD-013-bondinho-mt-chimney-lavaridge.md) | Bondinho de Mt. Chimney, Jagged Pass e Lavaridge | 452 passos main809b814; nav condicional validada, visual/natural pendentes | 2026-11-18 |
| [PRD-014](PRD-014-trechos-leste-mauville-lilycove.md) | Trechos leste de Mauville e acesso parcial a Lilycove | Main665aca4:375+139+85+175 passos separados,22 capturas/zero erros; corredor conectado/Surf/visual abertos | 2026-11-18 |
| [PRD-015](PRD-015-permissoes-nativas-de-movimento.md) | Leitores e condições nativas das permissões | PlayerGrid/fila e pedido62 recuperados; enums/camada/efeito inconclusivos, nenhuma regra nova (A-084/A-085) | 2026-11-18 |

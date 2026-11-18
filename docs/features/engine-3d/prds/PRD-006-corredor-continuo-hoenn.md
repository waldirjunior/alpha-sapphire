# PRD-006 — Corredor contínuo Littleroot–Petalburg

- **Estado:** Implementação verificada em testes; Playwright na main pendente
- **Fase:** 2 / P-017
- **Data:** 2026-11-17
- **Decisão:** [ADR-004](../adrs/ADR-004-bordas-por-zone-grid.md)

## Aceite

- [x] Gerar vizinhança pelo contato de zoneIds das MM, sem converter limites em warps.
- [x] Cruzar 6→23→7→24→13 com um tile mundial por passo, sem fade/câmera teletransportada.
- [x] Verificar colisão na origem/destino; carregar apenas vizinhos imediatos, sem percorrer o mundo inteiro.
- [x] Compor/cachear chunks vizinhos, manter chunks/atores existentes nas bordas e ignorar respostas obsoletas.
- [x] Carregar encontros diretamente do JSON `zones/NNN_*.json` da zona exata.
- [x] Stage do corredor e destinos diretos com correção/validação UV, sem conversores.
- [ ] Caminhada Playwright no checkout principal, screenshot por zona e auditoria de console/texturas/telas pretas.

## Limites explícitos

6/23/7/25 pertencem à MM1; 13/24 à MM2. A ponte 7↔24 é inferência de migração
aprovada pelo coordenador, não dado extraído da ROM. Os GRs possuem uma coluna
externa bloqueada de cada lado: a ponte liga Oldale x=1 a Route102 x=78 nas
linhas 20–22. O offset 78 faz o passo medir um tile mundial e não altera os grids.
As bordas intra-MM são automáticas; outras ligações entre matrizes não são inferidas.
Flags/VM/diálogos e paridade no emulador permanecem em P-013/P-017.

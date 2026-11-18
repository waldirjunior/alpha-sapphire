# PRD-008 — Corredor Petalburg–Rustboro

- **Estado:** Implementado e verificado em testes; Playwright na main pendente
- **Fase:** 2 / P-017, continuação do PRD-006
- **Data:** 2026-11-17
- **Decisão:** [ADR-004](../adrs/ADR-004-bordas-por-zone-grid.md), A-042/A-043

## Zonas e contrato de navegação

| Trecho | Zona | Matriz | Passagem |
| --- | --- | --- | --- |
| Petalburg City | 13 | MM2 | Ponte inferida para27 |
| Route104 sul | 27 | MM3 | Portal ZO real para82 |
| Petalburg Woods | 82 | MM43 | Portal ZO real para26 |
| Route104 norte | 26 | MM4 | Contato de zone-grid para16 |
| Rustboro City | 16 | MM4 | Destino da caminhada |

Zona25 é Route103, não Petalburg. Os IDs acima vêm de `src/data/zones.json`.
Os portais da floresta conservam retângulo, destino, orientação e efeito do ZO;
não se transformam interiores em bordas contínuas por inferência.

## Ponte Petalburg–Route104 sul

Os ZOs13/27 têm portais recíprocos com cinco lanes alinhadas em z=46..50.
Petalburg possui padding bloqueado em x=0; Route104 em x=77..79. A ponte liga
os tiles transitáveis `(1,z)` e `(76,z)`, com offset76 e um passo mundial.
Nenhuma colisão, NPC ou flag é alterada. Somente a lista explícita
`INFERRED_HORIZONTAL_BRIDGES` permite essa união, marcada `inferred=true`.
A topologia é apoiada pelos ZOs; o encaixe visual/coordenadas entre matrizes é
uma inferência de migração, não informação extraída do zone-grid.

A-040 continua valendo: o warp coincidente para o mesmo destino não pode
reancorar o jogador em `(77,46)/right`. O portal oposto também fica além do
limite transitável da ponte. Portas e outros destinos não são suprimidos.

## Aceite

- [x] Derivar 26↔16 da MM4, sem ponte inferida.
- [x] Registrar somente a nova ponte explícita13↔27; manter portais82 reais.
- [x] Cobrir cinco lanes, ida/retorno, facing, vetor mundial e saída do portal.
- [x] Verificar rota com todos os NPCs extraídos; spawnFlag sozinho não oculta ator.
- [x] Conferir encounters das cinco zonas contra os JSONs nativos.
- [x] Stage limitado: raízes, destinos ZO diretos e um salto de vizinhos visuais.
- [ ] Caminhar de Petalburg até o interior urbano de Rustboro na main, com
  screenshots e zero consoleErrors/pageErrors/erros de shader.

## Reprodução e limites

```bash
python3 -B -m scripts.build_zone_neighbors
python3 -B -m scripts.stage_zone_assets \
  --models-dir "$CHECKOUT/rom/extracted/models" \
  --public-dir "$CHECKOUT/public" \
  --zones 13 27 82 26 16 --include-neighbors
```

Seleção: 29 zonas, 53 GRs e 57 modelos de ator existentes. Seis IDs especiais
sem correspondente físico usam fallback, sem mascarar bits. A correção UV0
PICA ocorre antes da cópia; não há conversores nem binários no Git. O public
acumulado foi validado: 74 GRs e 68 atores, zero violações texCoord.

215 Vitest, 138 Python sem skips e build passaram. A caminhada Playwright ainda
não foi executada nesta revisão. Persistem P-013/P-017/P-019 e os limites de
PICA/combiners, flags e eventos de história; navegação não comprova paridade.

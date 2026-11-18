# ADR-004 — Bordas por zone-grid e mundo composto

- **Status:** Aceito
- **Data:** 2026-11-17
- **Requisito:** [PRD-006](../prds/PRD-006-corredor-continuo-hoenn.md)

`build_zone_neighbors.py` varre contatos ortogonais do grid MM (células 10×10),
agrupa spans contíguos e emite `_neighbors.json`: 58 zonas/90 bordas dirigidas.
Cada borda guarda direção, span de origem, offset local→local e inferred.
Uma BFS posiciona componentes e rejeita ciclos de offsets inconsistentes.
`build_zone_maps.py` também regenera esse grafo ao gerar os mapas completos.

Não existem owners comuns entre MM1 e MM2. A ligação 7↔24 é ponte explícita
inferred=true, aprovada pelo coordenador, com lanes transitáveis comuns e
padding externo preservado. Não se trata de extração de conexão nativa.
O offset é 78 tiles e não 80: cada GR possui uma coluna externa bloqueada;
Oldale (1,z) conecta a Route102 (78,z), z=20..22. Assim o passo mundial mede um.

O core mantém posições locais e verifica colisão no destino antes da mudança;
warps nativos têm prioridade, exceto quando uma ponte inferred=true substitui
explicitamente a mesma conexão/destino (A-040). O repositório carrega um salto de vizinhos por
vez e preserva o estado em falha. O renderer usa origens mundiais estáveis,
cache de modelos/chunks e acrescenta vizinhos sem apagar os objetos existentes.
A mudança de componente (ex.: interior) mantém o caminho de warp/teleporte;
passos adjacentes no mesmo componente mantêm interpolação da câmera/jogador.

Encontros vêm de `src/data/zones/NNN_*.json`, não de nomes potencialmente
repetidos de mapas nem de fallback manual. O cache de mapas aguarda essa fonte.
O staging inclui Petalburg e aplica glb_uv_fix no arquivo convertido de origem
antes de copiá-lo, evitando a reintrodução do texCoord esparso (A-026).

Verificação unitária cobre bordas reais/sintéticas, passo mundial, colisão,
ponte marcada, cache/chunks obsoletos e seleção de encontros por ID. A caminhada
Playwright na main é aceite separado; nenhuma conclusão de paridade gráfica
ou de conexão nativa entre as duas matrizes decorre dos testes.

# ADR-005 — Eventos de batalha e apresentação nativa

- Data: 2026-11-17
- Estado: aceito; transporte nativo validado na main ac4054d, paridade pendente.
- Escopo: P-012, [PRD-007](../prds/PRD-007-animacoes-nativas-no-runtime.md).

## Contexto

Aplicar o estado final antes da apresentação pode substituir o Pokémon que
acabou de cair. Inferir a categoria pelo botão ou animar ambos os lados por um
timer também perde a ordem real: velocidade, incapacitação e recoil pertencem
ao core. O core deve continuar executável sem DOM ou Three.js.

## Decisão

A resolução pura produz eventos imutáveis de golpe, perda de HP e queda. Os
eventos descrevem fatos da batalha, não nomes de clipes Three.js. O host calcula
o próximo estado, aguarda os modelos e apresenta os eventos em ordem antes de
adotá-lo, verificando que a batalha ainda é a mesma.

O engine traduz categoria em `physical/special`, HP em `damage` e queda em
`faint`. Aguarda `finished` do mixer, retorna a `idle` após ações comuns e segura
a pose final de queda. Ao descartar a cena, resolve esperas e remove listeners;
uma versão de carga impede anexar modelos antigos. O primeiro idle começa com
peso integral, sem transição da bind pose. Clipes ausentes não são inventados.

Os GLBs Pokémon preservam também OPAQUE/MASK/BLEND do GLTFLoader, mesmo sem
`extras.pica`; a heurística legada de recorte fica como default dos demais
modelos. O merge preserva materiais do GLB-base e não autoriza substituí-los por
um cutoff global. Isso não equivale a implementar os combiners PICA200 (A-033).

## Consequências

O renderer não decide dano nem altera o estado do core. Os eventos podem ser
consumidos sem WebGL nos testes e preservam uma fronteira reutilizável pelo
servidor. A apresentação local é sequencial; ainda não representa marcadores de
impacto, sincronização de expressões BCH ou paridade temporal com o emulador.
Os testes de mixer e catálogo não substituem a validação visual na main.

A-042/A-043 acrescentam a correção offline P-019, não um efeito do core ou
uma heurística global de material: a promoção restaura V da face somente com
proveniência BCH/SHA e transforma accessors clonados, preservando skin,
clipes e materiais. O renderer continua consumindo glTF comum; não transporta
ainda o estado dinâmico de expressão/visibilidade. A/B com assets publicados
valida a orientação-base de três personagens, não a paleta inteira nem
paridade com o emulador. Ver [evidência](../../pipeline-rom/face-expressions.md).

## Continuação P-019 — estado de expressão (2026-11-18)

PRD-009/A-046–A-048 estendem a fronteira já existente: ChangeFace guarda um
índice puro0..7 no ator AMX identificado, com casts/fallback0 evidenciados.
Projeção transporta a expressão sem acoplar o core a Three.js; posição de
spawn/borda continua autoritativa. O engine recebe paletas do catálogo,
clona material/textura por instância e aplica a translação DccMaya do frame
selecionado. Não altera UV, skin ou lógica de batalha.

A/B com AMX sintético e GLB real comprovou a seleção explícita de dois estados
no mesmo NPC e isolamento de outra instância. Isso não comprova fluxo natural
ROM nem paridade temporal. A rotina nativa de piscada foi localizada, mas o
clock/helper e todas as condições ainda não: não há timer automático no host.
P-019 permanece aberta para timing, cobertura residual e emulador.

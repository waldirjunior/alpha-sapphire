# PRD-006 — Animações nativas no runtime

- Estado: em andamento.
- Escopo: fase 2, P-012 e investigação P-019.

## Resultado

Consumir os GLBs GF1 integrados, sem alterar a lógica de dano ou depender de
Three.js no core. Publicar cópias locais ignoradas dos modelos selecionados
pelos encontros das zonas 6, 7, 23–30, starters/evoluções e personagens usados.

## Contrato

- O core emite eventos puros de golpe, dano e queda na ordem resolvida.
- O engine seleciona physical/special pelo golpe, damage ao receber dano,
  faint ao cair e idle ao esperar. Ações pontuais terminam antes da seguinte;
  faint mantém a pose final. Cancelamento/troca de cena libera listeners.
- Clipes nativos ausentes não são fabricados nem substituídos por outro golpe.
- Overworld prefere clipes nativos disponíveis e preserva fallback explícito
  quando não existe um equivalente identificado.
- Assets derivados e screenshots continuam locais/ignorados; apenas scripts,
  manifestos de promoção e evidência textual entram no Git.
- Investigar os UVs do rosto antes de aplicar correção. Se o canal é válido e
  o problema é seleção de expressão do atlas, não mascarar com remap genérico.
  Pés ausentes na geometria não são reconstruídos nesta tarefa.

## Aceite

Regressões determinísticas para eventos e mixer, suíte canônica, auditoria de
UV por material e Playwright no checkout principal mostrando batalha Route 101,
com screenshots antes/durante o golpe e distinção entre observações e limites.

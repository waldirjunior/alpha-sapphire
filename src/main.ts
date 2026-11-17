import { loadBattleTables } from './core/battleTables';
import { bundledBattleTableLoader } from './data/battle/loader';

// As tabelas de batalha chegam por chunks sob demanda; o jogo só inicia depois delas (ADR-004).
loadBattleTables(bundledBattleTableLoader)
  .then(() => import('./game'))
  .catch((error: unknown) => {
    const panel = document.createElement('pre');
    panel.style.color = '#f87171';
    panel.textContent = `Falha ao carregar dados de batalha: ${error instanceof Error ? error.message : String(error)}`;
    document.body.appendChild(panel);
  });

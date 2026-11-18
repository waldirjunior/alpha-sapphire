import { loadBattleTables } from './core/battleTables';
import { bundledBattleTableLoader } from './data/battle/loader';

// As tabelas de batalha chegam por chunks sob demanda; o jogo só inicia depois delas (ADR-004).
loadBattleTables(bundledBattleTableLoader)
  .then(async () => {
    const [{ zoneMaps, startingMapId, saveStorageKey }, { deserializeSave }] = await Promise.all([
      import('./data/maps_v2/runtime'), import('./core/save'),
    ]);
    const raw = window.localStorage.getItem(saveStorageKey(window.location.search));
    const saved = raw ? deserializeSave(raw) : null;
    await zoneMaps.load(startingMapId(window.location.search));
    if (saved) await zoneMaps.load(saved.state.player.mapId);
    return import('./game');
  })
  .catch((error: unknown) => {
    const panel = document.createElement('pre');
    panel.style.color = '#f87171';
    panel.textContent = `Falha ao carregar dados do jogo: ${error instanceof Error ? error.message : String(error)}`;
    document.body.appendChild(panel);
  });

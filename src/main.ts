import {
  type BattleState,
  createPokemonInstance,
  executeBattleTurn,
  rollWildEncounter,
  runFromBattle,
  startWildBattle,
} from './core/battle';
import { createInitialState, interact, isTallGrass, movePlayer } from './core/gameState';
import type { Direction } from './core/types';
import { MAPS } from './data/maps';
import { ROUTE_101_ENCOUNTERS } from './data/pokemon/route101';
import { SPECIES } from './data/pokemon/species';
import { SceneManager } from './engine/SceneManager';

const app = document.getElementById('app');
const hudPos = document.getElementById('hud-pos');
const dialogueBox = document.getElementById('dialogue-box');
const battleOverlay = document.getElementById('battle-overlay');
const battleEnemy = document.getElementById('battle-enemy');
const battlePlayer = document.getElementById('battle-player');
const battleLog = document.getElementById('battle-log');
const battleActions = document.getElementById('battle-actions');

if (!app) {
  throw new Error('Elemento #app não encontrado');
}

const sceneManager = new SceneManager(app);
let state = createInitialState('littleroot_town', MAPS);
let starterId: 'treecko' | 'torchic' | 'mudkip' = 'torchic';
let starter = createPokemonInstance(SPECIES[starterId], 5);
let activeBattle: BattleState | null = null;

const starterButtons = document.querySelectorAll<HTMLButtonElement>('#starter-bar button[data-starter]');
starterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (activeBattle) return;
    const id = btn.dataset.starter;
    if (id !== 'treecko' && id !== 'torchic' && id !== 'mudkip') return;
    starterId = id;
    starter = createPokemonInstance(SPECIES[starterId], 5);
    starterButtons.forEach((b) => b.classList.toggle('active', b.dataset.starter === starterId));
    btn.blur();
  });
});

function renderBattle(): void {
  sceneManager.syncBattle(activeBattle);
  if (!battleOverlay || !battleEnemy || !battlePlayer || !battleLog || !battleActions) return;
  if (!activeBattle) {
    battleOverlay.classList.remove('open');
    return;
  }

  battleOverlay.classList.add('open');
  const b = activeBattle;
  battleEnemy.textContent = `Selvagem: ${b.enemy.species.name} (Lv.${b.enemy.level}) — HP ${b.enemy.currentHp}/${b.enemy.maxHp}`;
  battlePlayer.textContent = `Seu Pokémon: ${b.player.species.name} (Lv.${b.player.level}) — HP ${b.player.currentHp}/${b.player.maxHp}`;
  battleLog.innerHTML = b.log.slice(-4).map((line) => `<div>${line}</div>`).join('');
  battleActions.innerHTML = '';

  if (b.status === 'ongoing') {
    b.player.moves.forEach((move, idx) => {
      const btn = document.createElement('button');
      btn.textContent = `${move.name} (${move.type})`;
      btn.onclick = () => {
        if (!activeBattle) return;
        activeBattle = executeBattleTurn(activeBattle, idx);
        starter = activeBattle.player;
        renderBattle();
      };
      battleActions.appendChild(btn);
    });

    const runBtn = document.createElement('button');
    runBtn.textContent = 'Fugir';
    runBtn.onclick = () => {
      if (!activeBattle) return;
      activeBattle = runFromBattle(activeBattle);
      renderBattle();
    };
    battleActions.appendChild(runBtn);
    return;
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Voltar ao mapa';
  closeBtn.onclick = () => {
    if (activeBattle?.status === 'defeat') {
      starter = createPokemonInstance(SPECIES[starterId], 5);
      state = createInitialState('littleroot_town', MAPS);
    }
    activeBattle = null;
    renderBattle();
    syncUi();
  };
  battleActions.appendChild(closeBtn);
}

function syncUi(): void {
  sceneManager.sync(state, MAPS);
  if (hudPos) {
    const mapName = MAPS[state.player.mapId]?.name ?? state.player.mapId;
    hudPos.textContent = `Mapa: ${mapName} | Pos: (${state.player.pos.x}, ${state.player.pos.z})`;
  }
  if (dialogueBox) {
    if (state.activeDialogue) {
      dialogueBox.textContent = `${state.activeDialogue.text}\n\n[Espaço / Enter para fechar]`;
      dialogueBox.classList.add('open');
    } else {
      dialogueBox.textContent = '';
      dialogueBox.classList.remove('open');
    }
  }
}

syncUi();

const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

window.addEventListener('keydown', (event) => {
  if (activeBattle) return;

  if (event.code === 'Space' || event.code === 'Enter') {
    event.preventDefault();
    state = interact(state, MAPS);
    syncUi();
    return;
  }

  const dir = KEY_TO_DIR[event.code];
  if (!dir) return;

  const prevPos = state.player.pos;
  state = movePlayer(state, dir, MAPS);
  const moved = prevPos.x !== state.player.pos.x || prevPos.z !== state.player.pos.z;
  const currentMap = MAPS[state.player.mapId];

  if (moved && currentMap && isTallGrass(currentMap, state.player.pos)) {
    const encounter = rollWildEncounter(ROUTE_101_ENCOUNTERS);
    const wildSpecies = encounter ? SPECIES[encounter.speciesId] : undefined;
    if (encounter && wildSpecies) {
      activeBattle = startWildBattle(starter, createPokemonInstance(wildSpecies, encounter.level));
      renderBattle();
    }
  }

  syncUi();
});

function animate(): void {
  requestAnimationFrame(animate);
  sceneManager.render();
}

animate();

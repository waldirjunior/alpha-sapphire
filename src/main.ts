import { createInitialState, interact, movePlayer } from './core/gameState';
import type { Direction } from './core/types';
import { MAPS } from './data/maps';
import { SceneManager } from './engine/SceneManager';

const app = document.getElementById('app');
const hudPos = document.getElementById('hud-pos');
const dialogueBox = document.getElementById('dialogue-box');

if (!app) {
  throw new Error('Elemento #app não encontrado');
}

const sceneManager = new SceneManager(app);
let state = createInitialState('littleroot_town', MAPS);

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
  if (event.code === 'Space' || event.code === 'Enter') {
    event.preventDefault();
    state = interact(state, MAPS);
    syncUi();
    return;
  }

  const dir = KEY_TO_DIR[event.code];
  if (!dir) return;

  state = movePlayer(state, dir, MAPS);
  syncUi();
});

function animate(): void {
  requestAnimationFrame(animate);
  sceneManager.render();
}

animate();

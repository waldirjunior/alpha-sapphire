import { createInitialState, movePlayer } from './core/gameState';
import type { Direction } from './core/types';
import { MAPS } from './data/maps';
import { SceneManager } from './engine/SceneManager';

const app = document.getElementById('app');
const hudPos = document.getElementById('hud-pos');

if (!app) {
  throw new Error('Elemento #app não encontrado');
}

const sceneManager = new SceneManager(app);
let state = createInitialState('littleroot_town', MAPS);
sceneManager.sync(state, MAPS);

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
  const dir = KEY_TO_DIR[event.code];
  if (!dir) return;

  state = movePlayer(state, dir, MAPS);
  sceneManager.sync(state, MAPS);

  if (hudPos) {
    hudPos.textContent = `Mapa: ${state.player.mapId} | Pos: (${state.player.pos.x}, ${state.player.pos.z})`;
  }
});

function animate(): void {
  requestAnimationFrame(animate);
  sceneManager.render();
}

animate();

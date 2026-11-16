import { createInitialState, movePlayer } from './core/gameState';
import type { Direction, MapDefinition } from './core/types';
import { SceneManager } from './engine/SceneManager';

const MAPS: Record<string, MapDefinition> = {
  littleroot_town: {
    id: 'littleroot_town',
    name: 'Littleroot Town (Placeholder)',
    width: 12,
    height: 12,
    collisions: Array.from({ length: 12 }, (_, z) =>
      Array.from({ length: 12 }, (_, x) =>
        x === 0 || z === 0 || x === 11 || z === 11 ? 1 : 0
      )
    ),
    warps: [
      {
        from: { x: 6, z: 1 },
        targetMapId: 'route_101',
        targetPos: { x: 6, z: 10 },
      },
    ],
  },
  route_101: {
    id: 'route_101',
    name: 'Route 101 (Placeholder)',
    width: 12,
    height: 12,
    collisions: Array.from({ length: 12 }, (_, z) =>
      Array.from({ length: 12 }, (_, x) =>
        x === 0 || z === 0 || x === 11 || z === 11 ? 1 : 0
      )
    ),
    warps: [
      {
        from: { x: 6, z: 10 },
        targetMapId: 'littleroot_town',
        targetPos: { x: 6, z: 2 },
      },
    ],
  },
};

const app = document.getElementById('app');
const hudPos = document.getElementById('hud-pos');

if (!app) {
  throw new Error('Elemento #app não encontrado');
}

const sceneManager = new SceneManager(app);
let state = createInitialState();
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

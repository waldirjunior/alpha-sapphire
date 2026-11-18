import * as THREE from 'three';
import type { SceneInspection } from '../engine/SceneManager';
import { VOID_SENTINEL, type AvatarFrames } from './frameMetrics';

type Layer = 'player' | 'terrain' | 'entities';
const LAYERS: readonly Layer[] = ['player', 'terrain', 'entities'];

function readFrame(view: SceneInspection, camera: THREE.Camera, target: THREE.WebGLRenderTarget, hidden: readonly Layer[]): Uint8Array {
  const previous = LAYERS.map((layer) => view[layer].visible);
  for (const layer of hidden) view[layer].visible = false;
  view.renderer.setRenderTarget(target);
  view.renderer.render(view.scene, camera);
  const rgba = new Uint8Array(target.width * target.height * 4);
  view.renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, rgba);
  LAYERS.forEach((layer, index) => { view[layer].visible = previous[index]; });
  return rgba;
}

/** Renderiza a cena de produção três vezes sobre um fundo sentinela, com os materiais reais. */
export function captureAvatarFrames(view: SceneInspection, camera: THREE.Camera): AvatarFrames {
  const size = view.renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y);
  const background = view.scene.background;
  view.scene.background = new THREE.Color().setRGB(VOID_SENTINEL[0] / 255, VOID_SENTINEL[1] / 255, VOID_SENTINEL[2] / 255);
  try {
    return {
      full: readFrame(view, camera, target, []),
      withoutPlayer: readFrame(view, camera, target, ['player']),
      playerOnly: readFrame(view, camera, target, ['terrain', 'entities']),
    };
  } finally {
    view.scene.background = background;
    view.renderer.setRenderTarget(null);
    target.dispose();
  }
}

/** Distância vertical entre o ponto mais baixo do modelo na pose atual e o chão onde o ator está apoiado. */
export function playerGroundGap(player: THREE.Object3D): number {
  player.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(player, true);
  return bounds.min.y - player.position.y;
}

export function closeupCamera(view: SceneInspection): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(30, view.camera.aspect, 0.1, 60);
  const { x, y, z } = view.player.position;
  camera.position.set(x + 1.1, y + 1.0, z + 3.6);
  camera.lookAt(x, y + 0.85, z);
  return camera;
}

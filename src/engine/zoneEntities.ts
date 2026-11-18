import * as THREE from 'three';
import { worldPosition } from '../core/boundaries';
import type { Direction, GridPosition, MapDefinition } from '../core/types';
import { createWarpMarkers } from './zoneTerrain';

export const FACING_YAW: Record<Direction, number> = {
  up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2,
};

type ActorLoader = (url: string, target: THREE.Group) => void;

function addNpc(group: THREE.Group, pos: GridPosition, modelUrl: string, facing: Direction | undefined, load: ActorLoader): void {
  const root = new THREE.Group();
  root.position.set(pos.x, 0, pos.z);
  root.rotation.y = FACING_YAW[facing ?? 'down'];
  const fallback = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 8),
    new THREE.MeshStandardMaterial({ color: '#f43f5e' }));
  fallback.position.y = 0.55;
  root.add(fallback);
  group.add(root);
  load(modelUrl, root);
}

function addSign(group: THREE.Group, pos: GridPosition): void {
  const sign = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), new THREE.MeshStandardMaterial({ color: '#92400e' }));
  post.position.y = 0.27;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.12), new THREE.MeshStandardMaterial({ color: '#fef3c7' }));
  board.position.y = 0.65;
  sign.add(post, board);
  sign.position.set(pos.x, 0, pos.z);
  group.add(sign);
}

export function appendMapEntities(map: MapDefinition, group: THREE.Group, load: ActorLoader): void {
  group.add(createWarpMarkers({ ...map, warps: map.warps.map((warp) => ({ ...warp, from: worldPosition(warp.from, map) })) }));
  for (const npc of map.npcs ?? []) addNpc(group, worldPosition(npc.pos, map), npc.modelUrl, npc.facing, load);
  for (const item of map.interactables ?? []) {
    const pos = worldPosition(item.pos, map);
    if (item.kind === 'sign') { addSign(group, pos); continue; }
    const url = item.npcModel === 'may' ? '/assets/characters/may/may.glb' : '/assets/characters/npc/npc.glb';
    addNpc(group, pos, url, item.facing, load);
  }
}

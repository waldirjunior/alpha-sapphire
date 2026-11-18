import * as THREE from 'three';
import { worldPosition } from '../core/boundaries';
import { groundedWorldPosition } from '../core/groundHeight';
import type { Direction, GridPosition, MapDefinition } from '../core/types';
import { createWarpMarkers } from './zoneTerrain';
import { npcActorId } from './eventHost';

export const FACING_YAW: Record<Direction, number> = {
  up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2,
};

export function eventActorRoot(map: MapDefinition, actorId: number, npcs: THREE.Group, player: THREE.Object3D): THREE.Object3D | undefined {
  if (actorId === 255) return player;
  const npc = map.npcs?.find(candidate => npcActorId(candidate) === actorId);
  return npc ? npcs.getObjectByName(npc.id) : undefined;
}

type ActorLoader = (url: string, target: THREE.Group) => void;
type ExpressionPort = { set(target: THREE.Object3D, expression?: number): void };

export function advanceActorPosition(root: THREE.Object3D, target: THREE.Vector3, dt: number): void {
  root.position.lerp(target, 1 - Math.exp(-18 * dt));
}

export function syncMapEntities(map: MapDefinition, group: THREE.Group, expressions: ExpressionPort): void {
  for (const npc of map.npcs ?? []) {
    const root = group.getObjectByName(npc.id);
    if (!root) continue;
    const pos = groundedWorldPosition(npc.pos, map);
    root.position.set(pos.x, pos.y, pos.z);
    root.rotation.y = FACING_YAW[npc.facing ?? 'down'];
    root.visible = npc.visible !== false;
    expressions.set(root, npc.faceExpression);
  }
}

function addNpc(group: THREE.Group, pos: GridPosition & { y: number }, modelUrl: string, facing: Direction | undefined, load: ActorLoader, id?: string): void {
  const root = new THREE.Group();
  if (id) root.name = id;
  root.position.set(pos.x, pos.y, pos.z);
  root.rotation.y = FACING_YAW[facing ?? 'down'];
  const fallback = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 8),
    new THREE.MeshStandardMaterial({ color: '#f43f5e' }));
  fallback.position.y = 0.55;
  root.add(fallback);
  group.add(root);
  load(modelUrl, root);
}

function addSign(group: THREE.Group, pos: GridPosition & { y: number }): void {
  const sign = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), new THREE.MeshStandardMaterial({ color: '#92400e' }));
  post.position.y = 0.27;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.12), new THREE.MeshStandardMaterial({ color: '#fef3c7' }));
  board.position.y = 0.65;
  sign.add(post, board);
  sign.position.set(pos.x, pos.y, pos.z);
  group.add(sign);
}

export function appendMapEntities(map: MapDefinition, group: THREE.Group, load: ActorLoader): void {
  group.add(createWarpMarkers({ ...map, warps: map.warps.map((warp) => ({ ...warp, from: worldPosition(warp.from, map) })) }));
  for (const npc of map.npcs ?? []) addNpc(group, groundedWorldPosition(npc.pos, map), npc.modelUrl, npc.facing, load, npc.id);
  for (const item of map.interactables ?? []) {
    const pos = groundedWorldPosition(item.pos, map);
    if (item.kind === 'sign') { addSign(group, pos); continue; }
    const url = item.npcModel === 'may' ? '/assets/characters/may/may.glb' : '/assets/characters/npc/npc.glb';
    addNpc(group, pos, url, item.facing, load);
  }
}

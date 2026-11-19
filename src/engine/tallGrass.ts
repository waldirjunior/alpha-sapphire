import * as THREE from 'three';
import { groundedWorldPosition } from '../core/groundHeight';
import type { GridPosition, MapDefinition } from '../core/types';

const TUFT_OFFSETS: readonly [number, number][] = [
  [-0.24, -0.22],
  [0.22, -0.24],
  [-0.22, 0.24],
  [0.24, 0.22],
];

function collectGrassCells(map: MapDefinition): GridPosition[] {
  const cells: GridPosition[] = [];
  if (!map.terrain) return cells;
  for (let z = 0; z < map.height; z++) {
    const row = map.terrain[z];
    if (!row) continue;
    for (let x = 0; x < map.width; x++) {
      if (row[x] === 2) cells.push({ x, z });
    }
  }
  return cells;
}

/** Cria tufos 3D instanciados sobre as células de grama alta (`terrain === 2`) da zona. */
export function buildTallGrassGroup(map: MapDefinition): THREE.Group | null {
  const cells = collectGrassCells(map);
  if (cells.length === 0) return null;

  const geometry = new THREE.ConeGeometry(0.14, 0.44, 4);
  geometry.translate(0, 0.2, 0);
  const material = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.85, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geometry, material, cells.length * TUFT_OFFSETS.length);
  mesh.name = `tall-grass:${map.id}`;

  const dummy = new THREE.Object3D();
  let instanceIndex = 0;
  for (const cell of cells) {
    const base = groundedWorldPosition(cell, map);
    for (let idx = 0; idx < TUFT_OFFSETS.length; idx++) {
      const [ox, oz] = TUFT_OFFSETS[idx];
      const seed = (cell.x * 37 + cell.z * 17 + idx * 13) % 11;
      dummy.position.set(base.x + ox, base.y, base.z + oz);
      dummy.rotation.set(0, seed * 0.55, 0);
      dummy.scale.setScalar(0.85 + (seed % 5) * 0.08);
      dummy.updateMatrix();
      mesh.setMatrixAt(instanceIndex++, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;

  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import type { GridPosition, MapDefinition } from '../core/types';

export function createWarpMarkers(map: Pick<MapDefinition, 'modelUrl' | 'warps'>): Group {
  const root = new Group();
  const geometry = new BoxGeometry(0.88, 0.06, 0.88);
  const material = new MeshStandardMaterial({ color: map.modelUrl ? '#f59e0b' : '#dc2626', transparent: true, opacity: 0.78 });
  for (const warp of map.warps) {
    const marker = new Mesh(geometry, material);
    marker.scale.set(warp.width ?? 1, 1, warp.height ?? 1);
    marker.position.set(warp.from.x + ((warp.width ?? 1) - 1) / 2, 0.03, warp.from.z + ((warp.height ?? 1) - 1) / 2);
    root.add(marker);
  }
  return root;
}

export async function loadZoneTerrain(
  chunks: { modelUrl: string; offset: GridPosition }[],
  load: (url: string) => Promise<{ scene: Object3D }>,
  configure: (model: Object3D) => void
): Promise<Group> {
  const models = await Promise.all(chunks.map(async (chunk) => {
    const { scene } = await load(chunk.modelUrl);
    scene.scale.setScalar(1 / 18);
    scene.position.set(chunk.offset.x + 19.5, 0, chunk.offset.z + 19.5);
    configure(scene);
    return scene;
  }));
  const root = new Group();
  root.add(...models);
  return root;
}

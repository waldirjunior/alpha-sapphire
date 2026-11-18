import { Group, type Object3D } from 'three';
import type { MapDefinition } from '../core/types';
import { loadZoneTerrain } from './zoneTerrain';

export class ContinuousTerrain {
  readonly root = new Group();
  private generation = 0;
  private chunks = new Map<string, Promise<void>>();
  private models = new Map<string, Promise<{ scene: Object3D }>>();

  constructor(private readonly load: (url: string) => Promise<{ scene: Object3D }>,
    private readonly configure: (model: Object3D) => void) {}

  reset(): void {
    this.generation++;
    this.root.clear();
    this.chunks.clear();
  }

  private async model(url: string): Promise<{ scene: Object3D }> {
    let pending = this.models.get(url);
    if (!pending) {
      pending = this.load(url);
      this.models.set(url, pending);
      pending.catch(() => this.models.delete(url));
    }
    const loaded = await pending;
    return { scene: loaded.scene.clone(true) };
  }

  private append(chunk: { modelUrl: string; offset: { x: number; z: number } }): Promise<void> {
    const key = `${chunk.modelUrl}:${chunk.offset.x}:${chunk.offset.z}`;
    const existing = this.chunks.get(key);
    if (existing) return existing;
    const generation = this.generation;
    const pending = loadZoneTerrain([chunk], (url) => this.model(url), this.configure).then((root) => {
      if (generation === this.generation) this.root.add(root);
    });
    this.chunks.set(key, pending);
    pending.catch(() => { if (generation === this.generation) this.chunks.delete(key); });
    return pending;
  }

  async sync(maps: readonly MapDefinition[]): Promise<void> {
    await Promise.all(maps.flatMap((map) => (map.modelChunks ?? []).map((chunk) => this.append({
      modelUrl: chunk.modelUrl,
      offset: { x: chunk.offset.x + (map.worldOrigin?.x ?? 0), z: chunk.offset.z + (map.worldOrigin?.z ?? 0) },
    }))));
  }
}

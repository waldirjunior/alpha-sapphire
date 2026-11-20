import * as THREE from 'three';
import type { BattleArena } from './battleArena';
import { attachBattleArenaModel, battleArenaModelUrl } from './battleArena';
import { fixOrasMaterials } from './picaMaterials';

export interface BattleArenaAssetLoader {
  load(
    url: string,
    onLoad: (result: { scene: THREE.Group }) => void,
    onProgress?: (event: ProgressEvent<EventTarget>) => void,
    onError?: (error: unknown) => void,
  ): void;
}

const requestedArenas = new WeakSet<BattleArena>();

export function loadBattleArenaModel(
  arena: BattleArena,
  loader: BattleArenaAssetLoader,
  getCurrentArena: () => BattleArena,
): void {
  if (requestedArenas.has(arena)) return;
  requestedArenas.add(arena);
  const url = battleArenaModelUrl(arena.biome);
  if (!url) return;

  loader.load(url, (result) => {
    if (getCurrentArena() !== arena) return;
    fixOrasMaterials(result.scene);
    attachBattleArenaModel(arena, result.scene);
  }, undefined, (error) => {
    console.warn(`Falha ao carregar arena ${arena.biome} em ${url}; mantendo fallback procedural.`, error);
  });
}

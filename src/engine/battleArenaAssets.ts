import * as THREE from 'three';
import type { BattleArena } from './battleArena';
import {
  attachBattleArenaModel,
  attachBattleArenaStageModel,
  battleArenaModelUrl,
  battleArenaStageModelUrl,
} from './battleArena';
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
  const stageUrl = battleArenaStageModelUrl(arena.biome);
  const layers = [
    { url: battleArenaModelUrl(arena.biome), attach: attachBattleArenaModel, name: 'arena' },
    ...(stageUrl
      ? [{ url: stageUrl, attach: attachBattleArenaStageModel, name: 'platforma' }]
      : []),
  ];

  for (const layer of layers) {
    loader.load(layer.url, (result) => {
      if (getCurrentArena() !== arena) return;
      fixOrasMaterials(result.scene);
      layer.attach(arena, result.scene);
    }, undefined, (error) => {
      console.warn(`Falha ao carregar camada ${layer.name} da arena ${arena.biome} em ${layer.url}; mantendo fallback procedural.`, error);
    });
  }
}

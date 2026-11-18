interface LoadingEvents {
  onStart?: (url: string, loaded: number, total: number) => void;
  onLoad?: () => void;
  onError?: (url: string) => void;
}

/** Observa o LoadingManager compartilhado pelos loaders da cena para saber quando nada mais está em voo. */
export class AssetTracker {
  readonly failed: string[] = [];
  private pending = false;

  constructor(manager: LoadingEvents) {
    manager.onStart = () => { this.pending = true; };
    manager.onLoad = () => { this.pending = false; };
    manager.onError = (url) => { this.failed.push(url); };
  }

  get idle(): boolean { return !this.pending; }
}

/**
 * Cargas encadeadas (props depois do mapa, fallback depois de erro) começam dentro do callback da anterior;
 * por isso a cena só conta como pronta após uma sequência de frames ociosos, não no primeiro `onLoad`.
 */
export async function waitForIdleFrames(tracker: AssetTracker, nextFrame: () => Promise<void>, idleFrames: number, maxFrames: number): Promise<void> {
  let streak = 0;
  for (let frame = 0; frame < maxFrames; frame += 1) {
    await nextFrame();
    streak = tracker.idle ? streak + 1 : 0;
    if (streak >= idleFrames) return;
  }
  throw new Error(`Assets ainda carregando após ${maxFrames} frames; esperado ${idleFrames} frames ociosos consecutivos`);
}

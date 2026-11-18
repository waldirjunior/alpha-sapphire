import { describe, expect, it } from 'vitest';
import { AssetTracker, waitForIdleFrames } from './assetTracker';

type Manager = ConstructorParameters<typeof AssetTracker>[0];

function scriptedFrames(manager: Manager, script: readonly ('start' | 'load' | 'none')[]): () => Promise<void> {
  let frame = 0;
  return async () => {
    const step = script[frame] ?? 'none';
    frame += 1;
    if (step === 'start') manager.onStart?.('/assets/map.glb', 0, 1);
    if (step === 'load') manager.onLoad?.();
  };
}

describe('AssetTracker', () => {
  it('records failed urls and stays idle until a load starts', () => {
    const manager: Manager = {};
    const tracker = new AssetTracker(manager);
    expect(tracker.idle).toBe(true);
    manager.onStart?.('/assets/a.glb', 0, 1);
    manager.onError?.('/assets/a.glb');
    expect(tracker.idle).toBe(false);
    manager.onLoad?.();
    expect(tracker).toMatchObject({ idle: true, failed: ['/assets/a.glb'] });
  });

  it('restarts the idle streak when a chained load begins', async () => {
    const manager: Manager = {};
    const tracker = new AssetTracker(manager);
    let frames = 0;
    const script = scriptedFrames(manager, ['start', 'load', 'none', 'start', 'load']);
    await waitForIdleFrames(tracker, async () => { frames += 1; await script(); }, 3, 50);
    expect(frames).toBe(7);
  });

  it('fails with the frame budget when assets never settle', async () => {
    const manager: Manager = {};
    const tracker = new AssetTracker(manager);
    manager.onStart?.('/assets/never.glb', 0, 1);
    await expect(waitForIdleFrames(tracker, async () => {}, 3, 10)).rejects.toThrow(/após 10 frames; esperado 3 frames ociosos/);
  });
});

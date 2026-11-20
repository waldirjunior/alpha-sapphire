import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { NativeAnimationController, characterClip } from './nativeAnimation';

function fixture(names = ['idle', 'physical', 'special', 'damage', 'faint']) {
  const mixer = new THREE.AnimationMixer(new THREE.Object3D());
  const clips = names.map((name) => new THREE.AnimationClip(name, 0.25, []));
  const actions = new Map(clips.map((clip) => [clip.name, mixer.clipAction(clip)]));
  const spy = vi.spyOn(mixer, 'clipAction').mockImplementation((clip) => {
    const action = actions.get(typeof clip === 'string' ? clip : clip.name);
    if (!action) throw new Error('Unexpected clip');
    return action;
  });
  return { mixer, clips, actions, spy, controller: new NativeAnimationController(mixer, clips) };
}

describe('native animation events', () => {
  it('applies the initial idle immediately instead of exposing the bind pose', () => {
    const { controller, mixer, actions } = fixture();
    mixer.update(0);
    expect(actions.get('idle')?.getEffectiveWeight()).toBe(1);
    controller.dispose();
  });

  it.each([['physical', 'physical'], ['special', 'special'], ['status', 'special']] as const)(
    'selects the native clip for %s then resumes idle', async (category, expectedClip) => {
      const { controller, mixer, spy, clips } = fixture();
      const done = controller.playEvent({ type: 'move', side: 'player', category });
      expect(spy).toHaveBeenLastCalledWith(clips.find((clip) => clip.name === expectedClip));
      mixer.update(1);
      await done;
      expect(controller.activeClip).toBe('idle');
      controller.dispose();
    });

  it('plays damage once and holds faint instead of restarting idle', async () => {
    const { controller, mixer } = fixture();
    const damage = controller.playEvent({ type: 'damage', side: 'enemy' });
    expect(controller.activeClip).toBe('damage');
    mixer.update(1);
    await damage;
    const faint = controller.playEvent({ type: 'faint', side: 'enemy' });
    mixer.update(1);
    await faint;
    expect(controller.activeClip).toBe('faint');
    controller.dispose();
  });

  it('exposes the current event clip time for synchronized material and visibility frames', () => {
    const { controller, mixer } = fixture();
    controller.playEvent({ type: 'move', side: 'player', category: 'physical' });
    mixer.update(1 / 30);
    expect(controller.activeTime).toBeCloseTo(1 / 30);
    controller.dispose();
  });

  it('sends clip time to an optional synchronized presentation callback', () => {
    const mixer = new THREE.AnimationMixer(new THREE.Object3D());
    const clips = ['idle', 'physical'].map(name => new THREE.AnimationClip(name, 1, []));
    const syncFrame = vi.fn();
    const disposeFrame = vi.fn();
    const controller = new NativeAnimationController(mixer, clips, { update: syncFrame, dispose: disposeFrame });
    controller.playEvent({ type: 'move', side: 'player', category: 'physical' });

    controller.update(1 / 30);

    expect(syncFrame).toHaveBeenLastCalledWith('physical', 1 / 30);
    controller.dispose();
    expect(disposeFrame).toHaveBeenCalledOnce();
  });

  it('does not invent a missing native clip and releases pending playback on disposal', async () => {
    const { controller } = fixture(['idle', 'physical']);
    await controller.playEvent({ type: 'faint', side: 'enemy' });
    expect(controller.activeClip).toBe('idle');
    const done = controller.playEvent({ type: 'move', side: 'player', category: 'physical' });
    controller.dispose();
    await done;
  });

  it('uses the same controller for native standing and moving without restarting repeated states', () => {
    const { controller, mixer, actions, spy } = fixture(['idle', 'walk', 'overworld_000', 'overworld_002']);
    expect(controller.activeClip).toBe('overworld_000');
    mixer.update(0);
    expect(actions.get('overworld_000')?.getEffectiveWeight()).toBe(1);
    controller.setMoving(true);
    expect(controller.activeClip).toBe('overworld_002');
    mixer.update(0.1);
    const time = actions.get('overworld_002')?.time;
    spy.mockClear();
    controller.setMoving(true);
    expect(spy).not.toHaveBeenCalled();
    expect(actions.get('overworld_002')?.time).toBe(time);
    controller.setMoving(false);
    expect(controller.activeClip).toBe('overworld_000');
    controller.dispose();
    expect(actions.get('overworld_000')?.isRunning()).toBe(false);
    expect(actions.get('overworld_002')?.isRunning()).toBe(false);
  });

  it('holds native standing when walking is unavailable and keeps actor mixers isolated', () => {
    const first = fixture(['overworld_000', 'overworld_002']);
    const second = fixture(['overworld_000']);
    first.controller.setMoving(true);
    second.controller.setMoving(true);
    expect(first.controller.activeClip).toBe('overworld_002');
    expect(second.controller.activeClip).toBe('overworld_000');
    first.controller.dispose();
    expect(second.actions.get('overworld_000')?.isRunning()).toBe(true);
    second.controller.dispose();
  });

  it('prefers explicit overworld poses and motions, with a procedural fallback', () => {
    const clips = ['idle', 'walk', 'overworld_000', 'overworld_002'].map((name) => new THREE.AnimationClip(name, 1, []));
    expect(characterClip(clips, false)?.name).toBe('overworld_000');
    expect(characterClip(clips, true)?.name).toBe('overworld_002');
    expect(characterClip(clips.slice(0, 2), true)?.name).toBe('walk');
  });
});

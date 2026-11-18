import * as THREE from 'three';
import type { BattleEvent } from '../core/battleEvents';

export interface CharacterAnimController {
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction | null;
  walk: THREE.AnimationAction | null;
  active: 'idle' | 'walk';
}

export function characterClip(clips: THREE.AnimationClip[], moving: boolean): THREE.AnimationClip | undefined {
  const native = THREE.AnimationClip.findByName(clips, moving ? 'overworld_002' : 'overworld_000');
  return native ?? THREE.AnimationClip.findByName(clips, moving ? 'walk' : 'idle') ?? undefined;
}

export class NativeAnimationController {
  private current: THREE.AnimationAction | null = null;
  private complete: (() => void) | null = null;
  private disposed = false;
  public activeClip = '';

  constructor(public readonly mixer: THREE.AnimationMixer, private readonly clips: THREE.AnimationClip[]) {
    mixer.addEventListener('finished', this.onFinished);
    this.idle();
  }

  private onFinished = (event: { action: THREE.AnimationAction }): void => {
    if (event.action !== this.current || this.disposed) return;
    const complete = this.complete;
    this.complete = null;
    if (this.activeClip !== 'faint') this.idle();
    complete?.();
  };

  private idle(): void {
    const clip = THREE.AnimationClip.findByName(this.clips, 'idle');
    if (!clip || this.disposed) return;
    const transition = this.current !== null;
    this.current?.fadeOut(0.1);
    this.current = this.mixer.clipAction(clip);
    this.activeClip = 'idle';
    this.current.clampWhenFinished = false;
    this.current.reset().setLoop(THREE.LoopRepeat, Infinity);
    if (transition) this.current.fadeIn(0.1);
    this.current.play();
  }

  public playEvent(event: BattleEvent): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const name = event.type === 'move' ? (event.category === 'physical' ? 'physical' : 'special') : event.type;
    const clip = THREE.AnimationClip.findByName(this.clips, name);
    if (!clip) return Promise.resolve();
    this.complete?.();
    this.current?.fadeOut(0.1);
    this.current = this.mixer.clipAction(clip);
    this.activeClip = name;
    this.current.clampWhenFinished = true;
    this.current.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.1).play();
    return new Promise((resolve) => { this.complete = resolve; });
  }

  public dispose(): void {
    this.disposed = true;
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    this.complete?.();
    this.complete = null;
  }
}

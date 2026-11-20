import * as THREE from 'three';
import type { BattleEvent } from '../core/battleEvents';

export function characterClip(clips: THREE.AnimationClip[], moving: boolean): THREE.AnimationClip | undefined {
  const native = THREE.AnimationClip.findByName(clips, moving ? 'overworld_002' : 'overworld_000');
  return native ?? THREE.AnimationClip.findByName(clips, moving ? 'walk' : 'idle') ?? undefined;
}

export interface AnimationFrameDriver {
  update(clip: string, elapsedSeconds: number): void;
  dispose(): void;
}

export class NativeAnimationController {
  private current: THREE.AnimationAction | null = null;
  private complete: (() => void) | null = null;
  private disposed = false;
  public activeClip = '';

  public get activeTime(): number {
    return this.current?.time ?? 0;
  }

  constructor(
    public readonly mixer: THREE.AnimationMixer,
    private readonly clips: THREE.AnimationClip[],
    private readonly frameDriver?: AnimationFrameDriver,
  ) {
    mixer.addEventListener('finished', this.onFinished);
    this.idle();
  }

  public update(deltaSeconds: number): void {
    this.mixer.update(deltaSeconds);
    this.frameDriver?.update(this.activeClip, this.activeTime);
  }

  private onFinished = (event: { action: THREE.AnimationAction }): void => {
    if (event.action !== this.current || this.disposed) return;
    const complete = this.complete;
    this.complete = null;
    if (this.activeClip !== 'faint') this.idle();
    complete?.();
  };

  private idle(): void {
    this.loop(characterClip(this.clips, false));
  }

  public setMoving(moving: boolean): void {
    this.loop(characterClip(this.clips, moving) ?? characterClip(this.clips, false));
  }

  private loop(clip: THREE.AnimationClip | undefined): void {
    if (!clip || this.disposed || this.activeClip === clip.name) return;
    const transition = this.current !== null;
    this.current?.fadeOut(0.1);
    this.current = this.mixer.clipAction(clip);
    this.activeClip = clip.name;
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
    this.frameDriver?.dispose();
    this.complete?.();
    this.complete = null;
  }
}

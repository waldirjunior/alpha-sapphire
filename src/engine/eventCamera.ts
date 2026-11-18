import { floatFromCell } from '../core/amxMemory';
import { worldPosition } from '../core/boundaries';
import type { AmxEffect } from '../core/amxTypes';
import type { MapDefinition } from '../core/types';

type CameraPoint = { x: number; y: number; z: number };
export interface EventCameraPose { eye: CameraPoint; target: CameraPoint; fov: number; roll: number }
interface CameraAnimation { from: EventCameraPose; to: EventCameraPose; elapsed: number; frames: number; easing: number }
const lerp = (from: number, to: number, fraction: number): number => from + (to - from) * fraction;
const point = (from: CameraPoint, to: CameraPoint, fraction: number): CameraPoint => ({
  x: lerp(from.x, to.x, fraction), y: lerp(from.y, to.y, fraction), z: lerp(from.z, to.z, fraction),
});

function cameraPose(args: readonly number[], map: MapDefinition): EventCameraPose | undefined {
  if (args[0] !== 0) return undefined;
  const values = args.slice(1).map(floatFromCell);
  if (values.some(value => !Number.isFinite(value) || value >= 100000000) || values[6] <= 0 || values[6] >= 180 || values[7] !== 0) return undefined;
  const location = (offset: number): CameraPoint => ({ ...worldPosition({
    x: values[offset] / 18 - (map.romOrigin?.x ?? 0), z: values[offset + 2] / 18 - (map.romOrigin?.z ?? 0),
  }, map), y: values[offset + 1] / 18 });
  return { eye: location(0), target: location(3), fov: values[6], roll: values[7] };
}

export class EventCamera {
  private initial: EventCameraPose | null = null;
  private destination: EventCameraPose | null = null;
  private displayed: EventCameraPose | null = null;
  private animation: CameraAnimation | null = null;
  private frames = 0;
  private easing = 0;

  constructor(private readonly capture: () => EventCameraPose, private readonly project: (pose: EventCameraPose) => void) {}
  get active(): boolean { return this.displayed !== null; }

  reset(): void {
    this.initial = null;
    this.destination = null;
    this.displayed = null;
    this.animation = null;
    this.frames = 0;
    this.easing = 0;
  }

  request(effect: AmxEffect, map: MapDefinition): number | undefined {
    if (effect.name === 'EVCameraIsEndFrame') return Number(this.animation === null);
    if (effect.name === 'EVCameraSetInitParam') {
      this.initial = this.capture();
      this.destination = this.initial;
      return 0;
    }
    if (effect.name === 'EVCameraSetDstParam' || effect.name === 'EVCameraSetSlideParam') {
      return this.setDestination(effect, map);
    }
    if (effect.name === 'EVCameraSetFrameParam') {
      const [delay, frames, easing, power] = effect.args;
      if (delay !== 0 || (easing !== 0 && easing !== 1) || power !== 0) return undefined;
      this.frames = frames & 0xffff;
      this.easing = easing;
      return 0;
    }
    if (effect.name === 'EVCameraBegin' && this.initial && this.destination) {
      this.animation = { from: this.initial, to: this.destination, elapsed: 0, frames: this.frames, easing: this.easing };
      this.render(this.frames === 0 ? 1 : 0);
      return 0;
    }
    return undefined;
  }

  tick(): void {
    if (!this.animation) return;
    this.animation.elapsed += 1;
    const linear = Math.min(1, this.animation.elapsed / this.animation.frames);
    this.render(this.animation.easing === 1 ? (1 - Math.cos(Math.PI * linear)) / 2 : linear);
  }

  private setDestination(effect: AmxEffect, map: MapDefinition): number | undefined {
    const pose = cameraPose(effect.args, map);
    if (!pose || !this.initial) return undefined;
    if (effect.name === 'EVCameraSetSlideParam') this.initial = this.destination;
    this.destination = pose;
    return 0;
  }

  private render(fraction: number): void {
    const animation = this.animation;
    if (!animation) return;
    const { from, to } = animation;
    this.displayed = { eye: point(from.eye, to.eye, fraction), target: point(from.target, to.target, fraction),
      fov: lerp(from.fov, to.fov, fraction), roll: lerp(from.roll, to.roll, fraction) };
    this.project(this.displayed);
    if (fraction >= 1) this.animation = null;
  }
}

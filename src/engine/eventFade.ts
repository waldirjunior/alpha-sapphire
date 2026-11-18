import type { AmxEffect } from '../core/amxTypes';

export class EventFade {
  private animation: { frames: number; elapsed: number; reveal: boolean } | null = null;
  constructor(private readonly project: (opacity: number) => void) {}

  reset(): void { this.animation = null; this.project(1); }

  request(effect: AmxEffect): number | undefined {
    if (effect.name === 'FadeIsEnd') return Number(this.animation === null);
    const reveal = effect.name === '_FadeRequestIn';
    if (!reveal && effect.name !== 'FadeRequestOut') return undefined;
    const frames = effect.args[reveal ? 1 : 2];
    if (effect.args[0] !== 0 || (!reveal && effect.args[1] !== 0) || frames < 0) return undefined;
    this.animation = { frames, elapsed: 0, reveal };
    this.project(reveal ? 0 : 1);
    if (frames === 0) { this.project(reveal ? 1 : 0); this.animation = null; }
    return 0;
  }

  tick(): void {
    if (!this.animation) return;
    this.animation.elapsed += 1;
    const { elapsed, frames, reveal } = this.animation;
    const fraction = Math.min(1, elapsed / frames);
    this.project(reveal ? fraction : 1 - fraction);
    if (fraction >= 1) this.animation = null;
  }
}

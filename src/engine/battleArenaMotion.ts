export interface ArenaPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PokeballShakeFrame {
  readonly offsetX: number;
  readonly roll: number;
}

export interface DamageReactionFrame {
  readonly offsetX: number;
  readonly flash: number;
}

export function parabolicFlightPoint(
  from: ArenaPoint,
  to: ArenaPoint,
  progress: number,
  height = 1.4
): ArenaPoint {
  const t = clampProgress(progress);
  if (t === 0) return { ...from };
  if (t === 1) return { ...to };
  const arc = Math.sin(Math.PI * t) * height;
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t + arc,
    z: from.z + (to.z - from.z) * t,
  };
}

export function normalizePokeballShakes(shakes: number): number {
  return Math.min(3, Math.max(1, Math.floor(Number.isFinite(shakes) ? shakes : 1)));
}

export function pokeballShakeFrame(progress: number): PokeballShakeFrame {
  const sway = Math.sin(clampProgress(progress) * Math.PI * 2);
  return { offsetX: sway * 0.12, roll: sway * 0.38 };
}

export function damageReactionFrame(progress: number, direction: number): DamageReactionFrame {
  const t = clampProgress(progress);
  const offsetX = t === 0 || t === 1 ? 0 : Math.sin(Math.PI * t) * 0.16 * Math.sign(direction);
  return { offsetX, flash: 1 - t };
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
}

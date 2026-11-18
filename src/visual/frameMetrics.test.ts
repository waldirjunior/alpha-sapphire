import { describe, expect, it } from 'vitest';
import { avatarMetrics, changedPixels, coveredPixels, voidRatio, VOID_SENTINEL } from './frameMetrics';

type Rgb = readonly [number, number, number];
const VOID: Rgb = VOID_SENTINEL;
const GRASS: Rgb = [40, 160, 60];
const ROOF: Rgb = [200, 60, 40];
const SKIN: Rgb = [240, 200, 170];

function frame(pixels: readonly Rgb[]): Uint8Array {
  return Uint8Array.from(pixels.flatMap(([r, g, b]) => [r, g, b, 255]));
}

describe('frame metrics', () => {
  it('counts only pixels that received geometry', () => {
    const rgba = frame([VOID, GRASS, VOID, ROOF]);
    expect(coveredPixels(rgba)).toBe(2);
    expect(voidRatio(rgba)).toBe(0.5);
  });

  it('treats one unit of rounding around the sentinel as void', () => {
    expect(coveredPixels(frame([[254, 1, 254]]))).toBe(0);
    expect(coveredPixels(frame([[250, 0, 255]]))).toBe(1);
  });

  it('reports an empty frame as having no void', () => {
    expect(voidRatio(new Uint8Array(0))).toBe(0);
  });

  it('ignores sub-threshold noise when comparing frames', () => {
    const a = frame([GRASS, GRASS, GRASS]);
    const b = frame([[42, 158, 60], [40, 160, 64], GRASS]);
    expect(changedPixels(a, b)).toBe(1);
  });

  it('rejects frames captured at different resolutions', () => {
    expect(() => changedPixels(frame([GRASS]), frame([GRASS, GRASS]))).toThrow(/tamanhos diferentes: 4 e 8/);
  });
});

describe('avatar metrics', () => {
  it('reports a fully visible avatar', () => {
    const metrics = avatarMetrics({
      full: frame([GRASS, SKIN, SKIN, GRASS]),
      withoutPlayer: frame([GRASS, GRASS, GRASS, GRASS]),
      playerOnly: frame([VOID, SKIN, SKIN, VOID]),
    });
    expect(metrics).toEqual({ visibility: 1, screenShare: 0.5 });
  });

  it('reports the visible fraction when a roof covers part of the avatar', () => {
    const metrics = avatarMetrics({
      full: frame([GRASS, ROOF, SKIN, GRASS]),
      withoutPlayer: frame([GRASS, ROOF, GRASS, GRASS]),
      playerOnly: frame([VOID, SKIN, SKIN, VOID]),
    });
    expect(metrics.visibility).toBe(0.5);
  });

  it('reports zero when the avatar never reaches the frame', () => {
    const metrics = avatarMetrics({
      full: frame([GRASS, GRASS]),
      withoutPlayer: frame([GRASS, GRASS]),
      playerOnly: frame([VOID, VOID]),
    });
    expect(metrics).toEqual({ visibility: 0, screenShare: 0 });
  });
});

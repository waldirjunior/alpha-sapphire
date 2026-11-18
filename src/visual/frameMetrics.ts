/** Cor de fundo exclusiva das passadas de medição: pixel igual a ela não recebeu geometria alguma. */
export const VOID_SENTINEL: readonly [number, number, number] = [255, 0, 255];

const CHANNELS = 4;
const SENTINEL_TOLERANCE = 1;
const CHANGE_TOLERANCE = 2;

function isVoid(rgba: Uint8Array, offset: number): boolean {
  return VOID_SENTINEL.every((value, channel) => Math.abs(rgba[offset + channel] - value) <= SENTINEL_TOLERANCE);
}

function differs(a: Uint8Array, b: Uint8Array, offset: number): boolean {
  for (let channel = 0; channel < 3; channel += 1) {
    if (Math.abs(a[offset + channel] - b[offset + channel]) > CHANGE_TOLERANCE) return true;
  }
  return false;
}

function assertSameSize(a: Uint8Array, b: Uint8Array): void {
  if (a.length !== b.length) throw new Error(`Frames com tamanhos diferentes: ${a.length} e ${b.length} bytes; esperado o mesmo buffer RGBA`);
}

export function coveredPixels(rgba: Uint8Array): number {
  let covered = 0;
  for (let offset = 0; offset < rgba.length; offset += CHANNELS) if (!isVoid(rgba, offset)) covered += 1;
  return covered;
}

export function voidRatio(rgba: Uint8Array): number {
  const pixels = rgba.length / CHANNELS;
  return pixels === 0 ? 0 : 1 - coveredPixels(rgba) / pixels;
}

export function changedPixels(a: Uint8Array, b: Uint8Array): number {
  assertSameSize(a, b);
  let changed = 0;
  for (let offset = 0; offset < a.length; offset += CHANNELS) if (differs(a, b, offset)) changed += 1;
  return changed;
}

export interface AvatarFrames {
  /** Cena completa. */
  full: Uint8Array;
  /** Mesma cena com o avatar oculto. */
  withoutPlayer: Uint8Array;
  /** Somente o avatar, sem terreno nem atores. */
  playerOnly: Uint8Array;
}

export interface AvatarMetrics {
  /** Fração do avatar que chega à tela; 1 = nada o encobre, 0 = totalmente oculto ou ausente. */
  visibility: number;
  /** Fração do frame que o avatar ocuparia sem oclusão. */
  screenShare: number;
}

export function avatarMetrics(frames: AvatarFrames): AvatarMetrics {
  const silhouette = coveredPixels(frames.playerOnly);
  const pixels = frames.full.length / CHANNELS;
  if (silhouette === 0) return { visibility: 0, screenShare: 0 };
  const visible = changedPixels(frames.full, frames.withoutPlayer);
  return { visibility: Math.min(1, visible / silhouette), screenShare: silhouette / pixels };
}

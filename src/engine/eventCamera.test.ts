import { describe, expect, it, vi } from 'vitest';
import { cellFromFloat } from '../core/amxMemory';
import type { AmxEffect } from '../core/amxTypes';
import type { MapDefinition } from '../core/types';
import { EventCamera, type EventCameraPose } from './eventCamera';

const map: MapDefinition = { id: 'synthetic', name: 'Synthetic', width: 8, height: 8, collisions: [], warps: [],
  romOrigin: { x: 10, z: 20 }, worldOrigin: { x: 100, z: 200 } };
const initial: EventCameraPose = { eye: { x: 100, y: 9, z: 208 }, target: { x: 100, y: 0.5, z: 200 }, fov: 45, roll: 0 };
const effect = (name: string, args: number[] = []): AmxEffect => ({ channel: 'camera', name, args });
const destination = [0, ...[216, 36, 432, 216, 0, 396, 30, 0].map(cellFromFloat)];

function fixture() {
  const project = vi.fn<(pose: EventCameraPose) => void>();
  const camera = new EventCamera(() => initial, project);
  camera.request(effect('EVCameraSetInitParam'), map);
  return { camera, project };
}

describe('câmera de eventos', () => {
  it('converte coordenadas ROM e aplica destino imediato antes de confirmar conclusão', () => {
    const { camera, project } = fixture();
    expect(camera.active).toBe(false);
    expect(camera.request(effect('EVCameraSetDstParam', destination), map)).toBe(0);
    camera.request(effect('EVCameraSetFrameParam', [0, 0, 0, 0]), map);
    camera.request(effect('EVCameraBegin'), map);
    expect(project).toHaveBeenLastCalledWith({ eye: { x: 102, y: 2, z: 204 }, target: { x: 102, y: 0, z: 202 }, fov: 30, roll: 0 });
    expect(camera.request(effect('EVCameraIsEndFrame'), map)).toBe(1);
    expect(camera.active).toBe(true);
  });
  it('só conclui transição após os frames efetivamente projetados', () => {
    const { camera, project } = fixture();
    camera.request(effect('EVCameraSetDstParam', destination), map);
    camera.request(effect('EVCameraSetFrameParam', [0, 4, 1, 0]), map);
    camera.request(effect('EVCameraBegin'), map);
    expect(camera.request(effect('EVCameraIsEndFrame'), map)).toBe(0);
    camera.tick();
    expect(project.mock.calls.at(-1)?.[0].fov).toBeCloseTo(45 + (30 - 45) * (1 - Math.cos(Math.PI / 4)) / 2);
    camera.tick();
    expect(project.mock.calls.at(-1)?.[0].fov).toBeCloseTo(37.5);
    camera.tick();
    expect(camera.request(effect('EVCameraIsEndFrame'), map)).toBe(0);
    camera.tick();
    expect(camera.request(effect('EVCameraIsEndFrame'), map)).toBe(1);
    expect(project.mock.calls.at(-1)?.[0].fov).toBe(30);
  });
  it('Slide usa o destino anterior e reset cancela apresentação e frames antigos', () => {
    const { camera, project } = fixture();
    camera.request(effect('EVCameraSetDstParam', destination), map);
    camera.request(effect('EVCameraBegin'), map);
    camera.request(effect('EVCameraSetSlideParam', [0, ...[252, 72, 468, 252, 0, 432, 60, 0].map(cellFromFloat)]), map);
    camera.request(effect('EVCameraSetFrameParam', [0, 4, 0, 0]), map);
    camera.request(effect('EVCameraBegin'), map);
    camera.tick();
    expect(project.mock.calls.at(-1)?.[0].fov).toBe(37.5);
    camera.reset();
    const calls = project.mock.calls.length;
    camera.tick();
    expect(camera.active).toBe(false);
    expect(project).toHaveBeenCalledTimes(calls);
  });
  it('não confirma modos, sentinelas ou easing ainda não implementados', () => {
    const { camera } = fixture();
    expect(camera.request(effect('EVCameraSetDstParam', [2, ...destination.slice(1)]), map)).toBeUndefined();
    expect(camera.request(effect('EVCameraSetDstParam', [0, cellFromFloat(100000000), ...destination.slice(2)]), map)).toBeUndefined();
    expect(camera.request(effect('EVCameraSetFrameParam', [1, 4, 0, 0]), map)).toBeUndefined();
    expect(camera.request(effect('EVCameraSetFrameParam', [0, 4, 2, 0]), map)).toBeUndefined();
    expect(camera.request(effect('EVCameraEnd', [0]), map)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import type { AmxEffect } from '../core/amxTypes';
import type { MapDefinition } from '../core/types';
import { EventPresentation } from './eventPresentation';

const map: MapDefinition = { id: 'synthetic', name: 'Synthetic', width: 8, height: 8, collisions: [], warps: [] };
const loading: AmxEffect = { channel: 'field', name: '_FieldMapBlockIsLoading', args: [] };

function fixture(ready: () => Promise<void> | null) {
  const camera = new PerspectiveCamera(45);
  const canvas = { style: { opacity: '1' } };
  const presentation = new EventPresentation(camera, canvas, () => ({ x: 0, y: 0.5, z: 0 }), ready);
  return { presentation, camera, canvas };
}

describe('serviços de apresentação AMX', () => {
  it('espera a carga de terreno real e descarta retorno de geração obsoleta', async () => {
    let finish = () => {};
    const ready = new Promise<void>(resolve => { finish = resolve; });
    const { presentation } = fixture(() => ready);
    let active = true;
    let completed = false;
    const result = presentation.request(loading, map, () => active).then(value => { completed = true; return value; });
    await Promise.resolve();
    expect(completed).toBe(false);
    active = false;
    finish();
    expect(await result).toBeUndefined();
    expect(await presentation.request(loading, map, () => true)).toBe(0);
  });
  it('mantém consulta opaca se o carregador de terreno não expõe uma conclusão', async () => {
    const { presentation } = fixture(() => null);
    expect(await presentation.request(loading, map, () => true)).toBeUndefined();
  });
  it('não sobrescreve câmera ativa com follow e restaura follow após reset', async () => {
    const { presentation, camera } = fixture(() => Promise.resolve());
    presentation.follow();
    expect(camera.position.toArray()).toEqual([0, 9, 8]);
    await presentation.request({ channel: 'camera', name: 'EVCameraSetInitParam', args: [] }, map, () => true);
    await presentation.request({ channel: 'camera', name: 'EVCameraBegin', args: [] }, map, () => true);
    camera.position.set(1, 2, 3);
    presentation.follow();
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
    presentation.reset();
    presentation.follow();
    expect(camera.position.toArray()).toEqual([0, 9, 8]);
  });
  it('mantém eye e target relativos ao pé em um terreno elevado sem alterar o ângulo', () => {
    const camera = new PerspectiveCamera(45);
    const target = { x: 38, y: 27.5, z: 5 };
    const presentation = new EventPresentation(camera, { style: { opacity: '1' } }, () => target, () => null);
    presentation.follow();
    expect(camera.position.toArray()).toEqual([38, 36, 13]);
    target.y = 21.5;
    presentation.follow();
    expect(camera.position.toArray()).toEqual([38, 30, 13]);
  });
  it('usa o enquadramento de follow observado em um ponto de oclusão', () => {
    const camera = new PerspectiveCamera(45);
    const target = { x: 78, y: 0.5, z: 48 };
    const presentation = new EventPresentation(camera, { style: { opacity: '1' } }, () => target, () => null,
      undefined, point => ({ eye: { x: point.x, y: point.y + 11.5, z: point.z + 2 },
        target: { x: point.x, y: point.y + 1.5, z: point.z - 2 }, backgroundColor: '#000000' }));
    presentation.follow();
    expect(camera.position.toArray()).toEqual([78, 12, 50]);
    const direction = camera.getWorldDirection(new Vector3());
    expect(direction.y).toBeCloseTo(-10 / Math.sqrt(116));
    expect(direction.z).toBeCloseTo(-4 / Math.sqrt(116));
  });
  it('projeta fade no canvas e reset cancela a apresentação', async () => {
    const { presentation, canvas } = fixture(() => Promise.resolve());
    await presentation.request({ channel: 'fade', name: 'FadeRequestOut', args: [0, 0, 2] }, map, () => true);
    presentation.tick();
    expect(canvas.style.opacity).toBe('0.5');
    presentation.reset();
    presentation.tick();
    expect(canvas.style.opacity).toBe('1');
    expect(presentation.cameraActive).toBe(false);
  });
});

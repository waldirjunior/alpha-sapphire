import { describe, expect, it } from 'vitest';
import { followCameraPose } from './cameraFollow';

describe('câmera de follow do overworld', () => {
  it('recua e mira pelo arco do Mauville Hall conforme a referência do oráculo', () => {
    expect(followCameraPose('zone_0445', { x: 78, y: 0.5, z: 48 })).toEqual({
      eye: { x: 78, y: 12, z: 50 },
      target: { x: 78, y: 2, z: 46 },
      backgroundColor: '#000000',
    });
  });

  it('mantém o follow original fora do hall e nas demais zonas', () => {
    expect(followCameraPose('zone_0445', { x: 82, y: 0.5, z: 48 })).toEqual({
      eye: { x: 82, y: 9, z: 56 },
      target: { x: 82, y: 0.5, z: 48 },
      backgroundColor: '#7dd3fc',
    });
    expect(followCameraPose('zone_0006', { x: 14, y: 0.5, z: 16 })).toEqual({
      eye: { x: 14, y: 9, z: 24 },
      target: { x: 14, y: 0.5, z: 16 },
      backgroundColor: '#7dd3fc',
    });
  });

  it('suaviza a passagem pela borda da zona da câmera do hall', () => {
    const pose = followCameraPose('zone_0445', { x: 79, y: 0.5, z: 48 });
    expect(pose.eye.z).toBeGreaterThan(50);
    expect(pose.eye.z).toBeLessThan(56);
    expect(pose.backgroundColor).not.toBe('#7dd3fc');
  });
});

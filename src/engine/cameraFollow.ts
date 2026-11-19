export interface CameraPoint {
  x: number;
  y: number;
  z: number;
}

export interface FollowCameraPose {
  eye: CameraPoint;
  target: CameraPoint;
  backgroundColor: string;
}

// PRD-016/P-021: a referência oculta o avatar em6, mas o mostra sob o arco em445(78,48).
const MAUVILLE_HALL = { mapId: 'zone_0445', x: 78, z: 48, radius: 3 };
const SKY_COLOR = [0x7d, 0xd3, 0xfc] as const;

function smoothstep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function mauvilleHallWeight(mapId: string, target: CameraPoint): number {
  if (mapId !== MAUVILLE_HALL.mapId) return 0;
  const distance = Math.hypot(target.x - MAUVILLE_HALL.x, target.z - MAUVILLE_HALL.z);
  return smoothstep(1 - distance / MAUVILLE_HALL.radius);
}

function blend(from: number, to: number, weight: number): number {
  return from + (to - from) * weight;
}

function backgroundColor(weight: number): string {
  const channels = SKY_COLOR.map(channel => Math.round(channel * (1 - weight)));
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function followCameraPose(mapId: string, target: CameraPoint): FollowCameraPose {
  const hall = mauvilleHallWeight(mapId, target);
  return {
    eye: { x: target.x, y: target.y + blend(8.5, 11.5, hall), z: target.z + blend(8, 2, hall) },
    target: { x: target.x, y: target.y + blend(0, 1.5, hall), z: target.z - 2 * hall },
    backgroundColor: backgroundColor(hall),
  };
}

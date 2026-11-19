import type { Direction } from '../core/types';

/** Portões de qualidade absolutos; cada um pode estar registrado como defeito conhecido por cenário. */
export type VisualGate = 'assetsLoaded' | 'avatarVisible' | 'terrainPresent' | 'feetOnGround';

export type KnownDefects = Partial<Record<VisualGate, string>>;

export interface VisualScenario {
  id: string;
  zone: number;
  x: number;
  z: number;
  facing: Direction;
  /** `game` usa a câmera de produção; `closeup` enquadra o avatar de frente para inspecionar o modelo. */
  camera: 'game' | 'closeup';
  gender?: 'male' | 'female';
  /** Estado de oclusão confirmado na captura original do oráculo. */
  expectedAvatarOcclusion?: 'occluded';
  /** Y em tiles usado como referência para selecionar entre pisos físicos sobrepostos. */
  referenceGroundY?: number;
  /** Máximo de vazio da captura quando o oráculo mostra o mundo recortado em preto. */
  maxVoidRatio?: number;
  /** Portão → pendência que explica por que ele falha hoje. O teste exige que continue falhando até ser removido daqui. */
  knownDefects: KnownDefects;
}

interface OverworldOptions {
  knownDefects?: KnownDefects;
  expectedAvatarOcclusion?: 'occluded';
  maxVoidRatio?: number;
  referenceGroundY?: number;
}

function overworld(id: string, zone: number, x: number, z: number, options: OverworldOptions = {}): VisualScenario {
  return { id, zone, x, z, facing: 'down', camera: 'game', knownDefects: options.knownDefects ?? {},
    ...(options.expectedAvatarOcclusion ? { expectedAvatarOcclusion: options.expectedAvatarOcclusion } : {}),
    ...(options.referenceGroundY === undefined ? {} : { referenceGroundY: options.referenceGroundY }),
    ...(options.maxVoidRatio === undefined ? {} : { maxVoidRatio: options.maxVoidRatio }) };
}

function closeup(id: string, gender: 'male' | 'female'): VisualScenario {
  return { id, zone: 6, x: 17, z: 14, facing: 'down', camera: 'closeup', gender, knownDefects: {} };
}

export const VISUAL_SCENARIOS: readonly VisualScenario[] = [
  closeup('avatar-brendan', 'male'),
  closeup('avatar-may', 'female'),
  overworld('z0006-littleroot-spawn', 6, 19, 1),
  overworld('z0006-littleroot-centro', 6, 17, 14),
  overworld('z0006-littleroot-telhado', 6, 14, 16, { expectedAvatarOcclusion: 'occluded' }),
  overworld('z0227-laboratorio-birch', 227, 14, 12),
  overworld('z0007-oldale', 7, 18, 5),
  overworld('z0013-petalburg', 13, 39, 54),
  overworld('z0082-petalburg-woods', 82, 28, 64),
  overworld('z0016-rustboro', 16, 47, 65),
  overworld('z0075-rusturf-tunnel', 75, 44, 11),
  overworld('z0011-verdanturf', 11, 16, 22),
  overworld('z0445-mauville-hall', 445, 78, 48, { maxVoidRatio: 0.7 }),
  overworld('z0015-mauville-patio', 15, 17, 22),
  overworld('z0015-mauville-patio-entry', 15, 2, 20),
  overworld('z0015-mauville-patio-upper-floor', 15, 14, 9, { referenceGroundY: 7.5 }),
  overworld('z0014-slateport', 14, 31, 22),
  overworld('z0037-route111', 37, 31, 66),
  overworld('z0039-route112', 39, 79, 65),
  overworld('z0010-fallarbor', 10, 21, 11),
  overworld('z0071-meteor-falls', 71, 57, 35),
  overworld('z0385-chimney-chegada', 385, 23, 18, { knownDefects: {} }),
  overworld('z0083-mt-chimney', 83, 31, 61),
  overworld('z0084-jagged-pass', 84, 38, 29),
  overworld('z0009-lavaridge', 9, 20, 21),
  overworld('z0047-route119', 47, 42, 22),
  overworld('z0046-route119-bridge-upper-floor', 46, 23, 40, { referenceGroundY: 15.5 }),
  overworld('z0018-lilycove', 18, 20, 21),
];

export function findVisualScenario(id: string | null): VisualScenario {
  const scenario = VISUAL_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Cenário visual desconhecido: ${id}; esperado um de ${VISUAL_SCENARIOS.map((candidate) => candidate.id).join(', ')}`);
  return scenario;
}

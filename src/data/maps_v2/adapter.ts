import type { Direction, GridPosition, GroundHeightCandidate, LateralLedge, MapDefinition } from '../../core/types';
import type { ZoneEncounterSlot } from '../../core/wildPokemon';

export interface ZoneMapSource {
  schemaVersion: number;
  id: string;
  zone: number;
  name: string;
  width: number;
  height: number;
  collisions: number[][];
  terrain: number[][];
  groundHeights?: (number | null)[][];
  groundHeightCandidates?: GroundHeightCandidate[];
  southLedges?: GridPosition[];
  lateralLedges?: LateralLedge[];
  surfTiles?: GridPosition[];
  spawnPos: GridPosition | null;
  spawnDerived: boolean;
  spawnPolicy: string;
  warps: { from: GridPosition; targetMapId: string; targetPos: GridPosition; width: number; height: number;
    rom: { faceDirection: number; transitionEffect: number } }[];
  npcs: { id: number; model: number; script: number; spawnFlag: number; faceDirection: number; pos: GridPosition }[];
  encounters: ZoneEncounterSlot[];
  source: { originTile?: GridPosition; groundHeightCandidatesPolicy?: string; chunks: { grId: number; localTile: GridPosition }[] };
}

export function romFacing(value: number): Direction | undefined {
  const directions: Partial<Record<number, Direction>> = { 0: 'down', 1: 'up', 2: 'left', 3: 'right' };
  return directions[value];
}

// Tabela em DllField.cro (0xf5d04..0xf6ce4): 0x2000..0x205b -> MM 354..445 e 0x1000..0x103f -> MM 446..509 (a/0/2/1).
export function zoneActorModelUrl(modelId: number): string {
  let mmIndex = modelId;
  if (Number.isInteger(modelId)) {
    if (modelId >= 0x2000 && modelId <= 0x205b) {
      mmIndex = 354 + (modelId - 0x2000);
    } else if (modelId >= 0x1000 && modelId <= 0x103f) {
      mmIndex = 446 + (modelId - 0x1000);
    }
  }
  return `/assets/characters/mm_${String(mmIndex).padStart(4, '0')}.glb`;
}

function validateZone(source: ZoneMapSource): void {
  const validGrid = (grid: number[][]): boolean => grid.length === source.height &&
    grid.every((row) => row.length === source.width && row.every(Number.isInteger));
  if (source.schemaVersion !== 2 || source.id !== `zone_${String(source.zone).padStart(4, '0')}` ||
    !Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < 1 || source.height < 1 ||
    !validGrid(source.collisions) || !validGrid(source.terrain)) {
    throw new Error(`Mapa ${source.id}: esperado schema v2 e grids width×height inteiros`);
  }
  if (source.groundHeights && (source.groundHeights.length !== source.height ||
    source.groundHeights.some(row => row.length !== source.width || row.some(value => value !== null && !Number.isFinite(value))))) {
    throw new Error(`Mapa ${source.id}: alturas exigem grid width×height finito ou null`);
  }
  const invalidHeightCandidate = source.groundHeightCandidates?.find(({ x, z, heights }) =>
    !Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= source.width || z >= source.height ||
    heights.length === 0 || heights.some(height => !Number.isFinite(height)));
  if (invalidHeightCandidate) {
    throw new Error(`Mapa ${source.id}: candidato de piso (${invalidHeightCandidate.x},${invalidHeightCandidate.z}) exige altura finita em uma célula válida`);
  }
  const invalidLedge = source.southLedges?.find(({ x, z }) => !Number.isInteger(x) || !Number.isInteger(z) || source.collisions[z]?.[x] !== 1);
  if (invalidLedge) {
    throw new Error(`Mapa ${source.id}: ledge sul (${invalidLedge.x},${invalidLedge.z}) exige coordenadas inteiras em tile bloqueado`);
  }
  const invalidLateralLedge = source.lateralLedges?.find(({ x, z, direction }) =>
    !Number.isInteger(x) || !Number.isInteger(z) || source.collisions[z]?.[x] !== 1 ||
    (direction !== 'left' && direction !== 'right'));
  if (invalidLateralLedge) {
    throw new Error(`Mapa ${source.id}: ledge lateral (${invalidLateralLedge.x},${invalidLateralLedge.z}) exige tile bloqueado e direção esquerda/direita`);
  }
  const invalidSurfTile = source.surfTiles?.find(({ x, z }) =>
    !Number.isInteger(x) || !Number.isInteger(z) || source.collisions[z]?.[x] !== 0);
  if (invalidSurfTile) {
    throw new Error(`Mapa ${source.id}: tile de Surf (${invalidSurfTile.x},${invalidSurfTile.z}) exige coordenadas inteiras em tile GR livre`);
  }
  if (source.warps.some((warp) => !Number.isInteger(warp.width) || warp.width < 1 || !Number.isInteger(warp.height) || warp.height < 1)) {
    throw new Error(`Mapa ${source.id}: warp com width/height inválidos`);
  }
}

export function adaptZoneMap(source: ZoneMapSource): MapDefinition {
  validateZone(source);
  return {
    id: source.id, zoneId: source.zone, name: source.name, width: source.width, height: source.height,
    collisions: source.collisions.map((row) => [...row]), terrain: source.terrain.map((row) => [...row]),
    groundHeights: source.groundHeights?.map(row => [...row]),
    groundHeightCandidates: source.groundHeightCandidates?.map(candidate => ({ ...candidate, heights: [...candidate.heights] })),
    southLedges: source.southLedges?.map(pos => ({ ...pos })),
    lateralLedges: source.lateralLedges?.map(ledge => ({ ...ledge })),
    surfTiles: source.surfTiles?.map(pos => ({ ...pos })),
    surfTileKeys: source.surfTiles ? new Set(source.surfTiles.map(({ x, z }) => `${x},${z}`)) : undefined,
    romOrigin: source.source.originTile ? { ...source.source.originTile } : undefined,
    spawnPos: source.spawnPos ? { ...source.spawnPos } : undefined,
    spawnDerived: source.spawnDerived, spawnPolicy: source.spawnPolicy,
    warps: source.warps.map((warp) => ({ from: { ...warp.from }, targetMapId: warp.targetMapId,
      targetPos: { ...warp.targetPos }, width: warp.width, height: warp.height,
      faceDirection: romFacing(warp.rom.faceDirection), transitionEffect: warp.rom.transitionEffect })),
    npcs: source.npcs.map((npc) => ({ ...npc, id: `${source.id}:npc:${npc.id}`, pos: { ...npc.pos },
      facing: romFacing(npc.faceDirection), modelUrl: zoneActorModelUrl(npc.model) })),
    encounters: source.encounters.map((slot) => ({ ...slot })),
    modelChunks: source.source.chunks.map((chunk) => ({ modelUrl: `/assets/maps/gr_${String(chunk.grId).padStart(4, '0')}/gr_${String(chunk.grId).padStart(4, '0')}.glb`,
      offset: { ...chunk.localTile } })),
  };
}

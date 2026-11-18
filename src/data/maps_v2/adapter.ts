import type { Direction, GridPosition, MapDefinition } from '../../core/types';
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
  spawnPos: GridPosition | null;
  spawnDerived: boolean;
  spawnPolicy: string;
  warps: { from: GridPosition; targetMapId: string; targetPos: GridPosition; width: number; height: number;
    rom: { faceDirection: number; transitionEffect: number } }[];
  npcs: { id: number; model: number; script: number; spawnFlag: number; faceDirection: number; pos: GridPosition }[];
  encounters: ZoneEncounterSlot[];
  source: { originTile?: GridPosition; chunks: { grId: number; localTile: GridPosition }[] };
}

export function romFacing(value: number): Direction | undefined {
  const directions: Partial<Record<number, Direction>> = { 0: 'down', 1: 'up', 2: 'left', 3: 'right' };
  return directions[value];
}

function validateZone(source: ZoneMapSource): void {
  const validGrid = (grid: number[][]): boolean => grid.length === source.height &&
    grid.every((row) => row.length === source.width && row.every(Number.isInteger));
  if (source.schemaVersion !== 2 || source.id !== `zone_${String(source.zone).padStart(4, '0')}` ||
    !Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < 1 || source.height < 1 ||
    !validGrid(source.collisions) || !validGrid(source.terrain)) {
    throw new Error(`Mapa ${source.id}: esperado schema v2 e grids width×height inteiros`);
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
    romOrigin: source.source.originTile ? { ...source.source.originTile } : undefined,
    spawnPos: source.spawnPos ? { ...source.spawnPos } : undefined,
    spawnDerived: source.spawnDerived, spawnPolicy: source.spawnPolicy,
    warps: source.warps.map((warp) => ({ from: { ...warp.from }, targetMapId: warp.targetMapId,
      targetPos: { ...warp.targetPos }, width: warp.width, height: warp.height,
      faceDirection: romFacing(warp.rom.faceDirection), transitionEffect: warp.rom.transitionEffect })),
    npcs: source.npcs.map((npc) => ({ ...npc, id: `${source.id}:npc:${npc.id}`, pos: { ...npc.pos },
      facing: romFacing(npc.faceDirection), modelUrl: `/assets/characters/mm_${String(npc.model).padStart(4, '0')}.glb` })),
    encounters: source.encounters.map((slot) => ({ ...slot })),
    modelChunks: source.source.chunks.map((chunk) => ({ modelUrl: `/assets/maps/gr_${String(chunk.grId).padStart(4, '0')}/gr_${String(chunk.grId).padStart(4, '0')}.glb`,
      offset: { ...chunk.localTile } })),
  };
}

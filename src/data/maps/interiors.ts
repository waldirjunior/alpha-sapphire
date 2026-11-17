import type { MapDefinition } from '../../core/types';
import birchLabTexts from '../texts/birch_lab.json';
import littlerootTexts from '../texts/littleroot_town.json';
import birchLabJson from './birch_lab.json';
import brendanHouseJson from './brendan_house.json';
import mayHouseJson from './may_house.json';

function createRoomCollisions(width: number, height: number): number[][] {
  return Array.from({ length: height }, (_, z) =>
    Array.from({ length: width }, (_, x) =>
      x === 0 || z === 0 || x === width - 1 || z === height - 1 ? 1 : 0
    )
  );
}

const HOUSE_COLLISIONS = createRoomCollisions(10, 8);
HOUSE_COLLISIONS[7][4] = 0; // Tapete de saída
HOUSE_COLLISIONS[7][5] = 0;

const LAB_COLLISIONS = createRoomCollisions(12, 10);
LAB_COLLISIONS[9][5] = 0; // Tapete de saída
LAB_COLLISIONS[9][6] = 0;

const POKECENTER_COLLISIONS = createRoomCollisions(10, 8);
POKECENTER_COLLISIONS[7][4] = 0;
POKECENTER_COLLISIONS[7][5] = 0;

export const INTERIOR_MAPS: Record<string, MapDefinition> = {
  brendan_house: {
    ...brendanHouseJson,
    name: 'Sua Casa (Littleroot)',
    spawnPos: { x: 16, z: 17 },
    modelUrl: '/assets/maps/brendan_house/brendan_house.glb',
    warps: [
      { from: { x: 15, z: 18 }, targetMapId: 'littleroot_town', targetPos: { x: 14, z: 12 } },
      { from: { x: 16, z: 18 }, targetMapId: 'littleroot_town', targetPos: { x: 14, z: 12 } },
      { from: { x: 17, z: 18 }, targetMapId: 'littleroot_town', targetPos: { x: 14, z: 12 } },
    ],
    interactables: [
      {
        id: 'mom_heal_interior',
        pos: { x: 15, z: 13 },
        kind: 'npc',
        npcModel: 'npc',
        text:
          littlerootTexts.lines[0] ??
          'Mãe: Descanse um pouco em casa! Seu time foi totalmente curado.',
        setFlag: 'intro_completed',
      },
      {
        id: 'home_tv_sign',
        pos: { x: 12, z: 12 },
        kind: 'sign',
        text: 'TV: Reportagem especial da região de Hoenn — Ginásio de Petalburg!',
      },
    ],
  },
  birch_lab: {
    ...birchLabJson,
    name: 'Laboratório do Prof. Birch',
    spawnPos: { x: 14, z: 21 },
    modelUrl: '/assets/maps/birch_lab/birch_lab.glb',
    warps: [
      { from: { x: 13, z: 22 }, targetMapId: 'littleroot_town', targetPos: { x: 16, z: 24 } },
      { from: { x: 14, z: 22 }, targetMapId: 'littleroot_town', targetPos: { x: 16, z: 24 } },
      { from: { x: 15, z: 22 }, targetMapId: 'littleroot_town', targetPos: { x: 16, z: 24 } },
    ],
    interactables: [
      {
        id: 'birch_lab_prof',
        pos: { x: 14, z: 10 },
        kind: 'npc',
        npcModel: 'npc',
        text:
          birchLabTexts.lines[0] ??
          'Prof. Birch: Excelente trabalho! Pegue estas Poké Balls extras e explore Hoenn!',
        setFlag: 'visited_birch_lab',
      },
    ],
  },
  oldale_pokecenter: {
    id: 'oldale_pokecenter',
    name: 'Centro Pokémon (Oldale)',
    width: 10,
    height: 8,
    spawnPos: { x: 4, z: 6 },
    collisions: POKECENTER_COLLISIONS,
    warps: [
      { from: { x: 4, z: 7 }, targetMapId: 'oldale_town', targetPos: { x: 13, z: 16 } },
      { from: { x: 5, z: 7 }, targetMapId: 'oldale_town', targetPos: { x: 13, z: 16 } },
    ],
    interactables: [
      {
        id: 'nurse_joy_oldale',
        pos: { x: 4, z: 2 },
        kind: 'npc',
        npcModel: 'npc',
        text: 'Enfermeira Joy: Seus Pokémon foram restaurados com energia máxima!',
      },
    ],
  },
  may_house: {
    ...mayHouseJson,
    name: 'Casa da Vizinha (Littleroot)',
    spawnPos: { x: 8, z: 17 },
    modelUrl: '/assets/maps/may_house/may_house.glb',
    warps: [
      { from: { x: 7, z: 18 }, targetMapId: 'littleroot_town', targetPos: { x: 25, z: 12 } },
      { from: { x: 8, z: 18 }, targetMapId: 'littleroot_town', targetPos: { x: 25, z: 12 } },
      { from: { x: 9, z: 18 }, targetMapId: 'littleroot_town', targetPos: { x: 25, z: 12 } },
    ],
    interactables: [
      {
        id: 'may_house_mom',
        pos: { x: 10, z: 13 },
        kind: 'npc',
        npcModel: 'npc',
        text: 'Vizinha: A May subiu para pesquisar Pokémon na Route 103!',
      },
    ],
  },
  oldale_mart: {
    id: 'oldale_mart',
    name: 'Poké Mart (Oldale)',
    width: 10,
    height: 8,
    spawnPos: { x: 4, z: 6 },
    collisions: POKECENTER_COLLISIONS,
    warps: [
      { from: { x: 4, z: 7 }, targetMapId: 'oldale_town', targetPos: { x: 26, z: 15 } },
      { from: { x: 5, z: 7 }, targetMapId: 'oldale_town', targetPos: { x: 26, z: 15 } },
    ],
    interactables: [
      {
        id: 'oldale_mart_clerk',
        pos: { x: 3, z: 3 },
        kind: 'npc',
        npcModel: 'npc',
        text: 'Atendente do Mart: Aqui está uma amostra grátis de Poké Ball e Potion!',
        setFlag: 'oldale_mart_sample',
      },
    ],
  },
};

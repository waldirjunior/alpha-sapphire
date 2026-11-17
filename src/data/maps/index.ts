import type { MapDefinition } from '../../core/types';
import { INTERIOR_MAPS } from './interiors';
import birchLabTexts from '../texts/birch_lab.json';
import littlerootTexts from '../texts/littleroot_town.json';
import oldaleTexts from '../texts/oldale_town.json';
import littlerootTown from './littleroot_town.json';
import oldaleTown from './oldale_town.json';
import petalburgCity from './petalburg_city.json';
import route101 from './route_101.json';
import route102 from './route_102.json';
import route102West from './route_102_west.json';
import route103 from './route_103.json';

export const MAPS: Record<string, MapDefinition> = {
  ...INTERIOR_MAPS,
  littleroot_town: {
    ...littlerootTown,
    modelUrl: '/assets/maps/littleroot_town/littleroot_town.glb',
    warps: [
      ...littlerootTown.warps,
      { from: { x: 13, z: 12 }, targetMapId: 'brendan_house', targetPos: { x: 4, z: 6 } },
      { from: { x: 16, z: 24 }, targetMapId: 'birch_lab', targetPos: { x: 5, z: 8 } },
    ],
    interactables: [
      {
        id: 'littleroot_town_sign',
        pos: { x: 19, z: 14 },
        kind: 'sign',
        text: littlerootTexts.lines[9] ?? 'Littleroot Town',
        setFlag: 'read_littleroot_sign',
      },
      {
        id: 'birch_lab_sign',
        pos: { x: 17, z: 23 },
        kind: 'sign',
        text: littlerootTexts.lines[10] ?? "Professor Birch's Pokémon Lab",
      },
      {
        id: 'mom_npc',
        pos: { x: 14, z: 12 },
        kind: 'npc',
        npcModel: 'npc',
        text: littlerootTexts.lines[0] ?? 'Don’t push yourself too hard, honey!',
      },
      {
        id: 'may_littleroot_npc',
        pos: { x: 26, z: 12 },
        kind: 'npc',
        npcModel: 'may',
        text: littlerootTexts.lines[13] ?? 'Whoa! Are we in sync or what!',
      },
      {
        id: 'littleroot_npc_warning',
        pos: { x: 20, z: 4 },
        kind: 'npc',
        npcModel: 'npc',
        text: littlerootTexts.lines[3] ?? 'Watch out for wild Pokémon in the tall grass!',
      },
    ],
  },
  route_101: {
    ...route101,
    modelUrl: '/assets/maps/route_101/route_101.glb',
    propsUrl: '/assets/maps/route_101/route_101_props.glb',
    interactables: [
      {
        id: 'prof_birch_npc',
        pos: { x: 20, z: 26 },
        kind: 'npc',
        npcModel: 'npc',
        text:
          birchLabTexts.lines[2] ??
          'Prof. Birch: Obrigado por explorar a Route 101! Escolha seu inicial no topo da tela e teste os encontros na grama alta.',
        setFlag: 'met_birch_route_101',
      },
      {
        id: 'route_101_sign',
        pos: { x: 21, z: 34 },
        kind: 'sign',
        text: 'Route 101 — Sul: Littleroot Town | Norte: Oldale Town',
      },
    ],
  },
  oldale_town: {
    ...oldaleTown,
    modelUrl: '/assets/maps/oldale_town/oldale_town.glb',
    warps: [
      ...oldaleTown.warps,
      { from: { x: 16, z: 18 }, targetMapId: 'oldale_pokecenter', targetPos: { x: 4, z: 6 } },
    ],
    interactables: [
      {
        id: 'oldale_town_sign',
        pos: { x: 20, z: 25 },
        kind: 'sign',
        text: oldaleTexts.lines[2] ?? 'Oldale Town',
      },
      {
        id: 'oldale_pokecenter',
        pos: { x: 17, z: 18 },
        kind: 'npc',
        npcModel: 'npc',
        text: 'Bem-vindo ao Centro Pokémon de Oldale! Sua equipe foi totalmente curada.',
      },
      {
        id: 'oldale_mart_npc',
        pos: { x: 24, z: 18 },
        kind: 'npc',
        npcModel: 'npc',
        text: oldaleTexts.lines[0] ?? 'Oldale Town — Where things start off scarce.',
      },
    ],
  },
  route_103: {
    ...route103,
    modelUrl: '/assets/maps/route_103/route_103.glb',
    interactables: [
      {
        id: 'rival_may_103',
        pos: { x: 20, z: 16 },
        kind: 'npc',
        npcModel: 'may',
        facing: 'down',
        sightRange: 3,
        text: 'May: Ei! Que tal testarmos quem treinou melhor até agora na Route 103?',
        requiredFlag: 'defeated_trainer:rival_may_103',
        altText: 'May: Você mandou muito bem! Nos vemos no caminho para Petalburg!',
        trainer: {
          name: 'Rival May',
          speciesId: 'treecko',
          level: 5,
        },
      },
    ],
  },
  route_102: {
    ...route102,
    modelUrl: '/assets/maps/route_102/route_102.glb',
    interactables: [
      {
        id: 'route_102_trainer_calvin',
        pos: { x: 22, z: 20 },
        kind: 'npc',
        npcModel: 'npc',
        facing: 'left',
        sightRange: 3,
        text: 'Youngster Calvin: Vamos testar nossos Pokémon na Route 102!',
        requiredFlag: 'defeated_trainer:route_102_trainer_calvin',
        altText: 'Youngster Calvin: Seu Pokémon já está bem treinado!',
        trainer: {
          name: 'Youngster Calvin',
          speciesId: 'poochyena',
          level: 5,
        },
      },
    ],
  },
  route_102_west: {
    ...route102West,
    modelUrl: '/assets/maps/route_102_west/route_102_west.glb',
  },
  petalburg_city: {
    ...petalburgCity,
    modelUrl: '/assets/maps/petalburg_city/petalburg_city.glb',
    interactables: [
      {
        id: 'petalburg_gym_sign',
        pos: { x: 18, z: 14 },
        kind: 'sign',
        text: 'Petalburg City Pokémon Gym — Líder: Norman',
      },
    ],
  },
};

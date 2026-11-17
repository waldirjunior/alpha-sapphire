import type { MapDefinition } from '../../core/types';
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
  littleroot_town: {
    ...littlerootTown,
    modelUrl: '/assets/maps/littleroot_town/littleroot_town.glb',
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
        id: 'littleroot_npc_warning',
        pos: { x: 20, z: 4 },
        kind: 'npc',
        text: littlerootTexts.lines[3] ?? 'Watch out for wild Pokémon in the tall grass!',
      },
    ],
  },
  route_101: {
    ...route101,
    modelUrl: '/assets/maps/route_101/route_101.glb',
  },
  oldale_town: {
    ...oldaleTown,
    modelUrl: '/assets/maps/oldale_town/oldale_town.glb',
    interactables: [
      {
        id: 'oldale_town_sign',
        pos: { x: 20, z: 25 },
        kind: 'sign',
        text: oldaleTexts.lines[2] ?? 'Oldale Town',
      },
      {
        id: 'oldale_pokecenter',
        pos: { x: 16, z: 18 },
        kind: 'npc',
        text: 'Bem-vindo ao Centro Pokémon de Oldale! Sua equipe foi totalmente curada.',
      },
    ],
  },
  route_103: {
    ...route103,
    modelUrl: '/assets/maps/route_103/route_103.glb',
  },
  route_102: {
    ...route102,
    modelUrl: '/assets/maps/route_102/route_102.glb',
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

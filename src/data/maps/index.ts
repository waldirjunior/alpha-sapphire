import type { MapDefinition } from '../../core/types';
import littlerootTown from './littleroot_town.json';
import oldaleTown from './oldale_town.json';
import route101 from './route_101.json';

export const MAPS: Record<string, MapDefinition> = {
  littleroot_town: littlerootTown,
  route_101: route101,
  oldale_town: oldaleTown,
};

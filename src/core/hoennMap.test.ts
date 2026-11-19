import { describe, expect, it } from 'vitest';
import {
  HOENN_LOCATIONS,
  HOENN_MAP_CONNECTIONS,
  HOENN_MAP_VIEWBOX,
  resolveHoennLocation,
} from './hoennMap';

describe('Hoenn map', () => {
  it('defines all routes and notable Hoenn places inside the SVG viewbox', () => {
    const routes = HOENN_LOCATIONS.filter(({ kind }) => kind === 'route');
    expect(routes.map(({ name }) => name)).toEqual(
      Array.from({ length: 34 }, (_, index) => `Route ${101 + index}`),
    );
    expect(HOENN_LOCATIONS.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'Littleroot Town', 'Petalburg City', 'Mauville City', 'Sootopolis City',
      'Pokémon League', 'Meteor Falls', 'Mt. Chimney', 'Sky Pillar', 'Battle Resort',
      'New Mauville', 'Team Aqua Hideout', 'Team Magma Hideout', 'Scorched Slab',
      'Mirage Forest', 'Mirage Cave', 'Mirage Island', 'Mirage Mountain', 'S.S. Tidal',
      'Crescent Isle', 'Trackless Forest', 'Pathless Plain', 'Nameless Cavern',
      'Fabled Cave', 'Gnarled Den', 'Secret Meadow', 'Secret Islet', 'Secret Shore',
    ]));
    for (const location of HOENN_LOCATIONS) {
      expect(location.x).toBeGreaterThanOrEqual(0);
      expect(location.x).toBeLessThanOrEqual(HOENN_MAP_VIEWBOX.width);
      expect(location.y).toBeGreaterThanOrEqual(0);
      expect(location.y).toBeLessThanOrEqual(HOENN_MAP_VIEWBOX.height);
      expect(location.description.trim()).not.toBe('');
    }
  });

  it('connects Hoenn locations only through declared map entries', () => {
    const locationIds = new Set(HOENN_LOCATIONS.map(({ id }) => id));
    expect(HOENN_MAP_CONNECTIONS.length).toBeGreaterThan(30);
    for (const [from, to] of HOENN_MAP_CONNECTIONS) {
      expect(locationIds.has(from)).toBe(true);
      expect(locationIds.has(to)).toBe(true);
    }
  });

  it('resolves the current zone, map aliases, and unknown maps safely', () => {
    expect(resolveHoennLocation('zone_0006', 'Littleroot Town')?.id).toBe('littleroot-town');
    expect(resolveHoennLocation('route_101')?.id).toBe('route-101');
    expect(resolveHoennLocation('brendan_house', 'Sua Casa (Littleroot)')?.id).toBe('littleroot-town');
    expect(resolveHoennLocation('zone_0006')?.id).toBe('littleroot-town');
    expect(resolveHoennLocation('unknown-map', 'Unknown Location')).toBeNull();
  });
});

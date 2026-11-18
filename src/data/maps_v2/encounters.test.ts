import { expect, it, vi } from 'vitest';
import { createZoneEncounterLoader } from './encounters';

it('uses the exact zone ID, not a duplicated map name, and caches native encounter slots', async () => {
  const route = { species: 261, form: 0, levelMin: 2, levelMax: 3 };
  const interior = vi.fn(async () => ({ name: 'Same name', encounters: [] }));
  const exterior = vi.fn(async () => ({ name: 'Same name', encounters: [route] }));
  const get = createZoneEncounterLoader({ '../zones/006_same_name.json': interior, '../zones/023_same_name.json': exterior });
  expect(await get(23)).toEqual([route]);
  expect(await get(23)).toEqual([route]);
  expect(exterior).toHaveBeenCalledTimes(1);
  expect(interior).not.toHaveBeenCalled();
  await expect(get(24)).rejects.toThrow(/zona 24/);
});

interface ZoneTextBank {
  lines: string[];
}

const TEXT_BANKS = import.meta.glob<ZoneTextBank>('../data/texts/zones/*.json', { import: 'default' });
const cache = new Map<number, Promise<readonly string[]>>();

/** Carrega sob demanda o banco de textos extraído da ROM para uma zona. */
export function loadZoneTextLines(zoneId: number | undefined): Promise<readonly string[]> {
  if (zoneId === undefined) return Promise.resolve([]);
  const existing = cache.get(zoneId);
  if (existing) return existing;

  const prefix = `${String(zoneId).padStart(3, '0')}_`;
  const entry = Object.entries(TEXT_BANKS).find(([path]) => path.split('/').at(-1)?.startsWith(prefix));
  if (!entry) return Promise.resolve([]);

  const pending = entry[1]().then((bank) => bank.lines).catch(() => []);
  cache.set(zoneId, pending);
  return pending;
}

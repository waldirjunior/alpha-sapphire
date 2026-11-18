export interface MemoryImage { sha256: string; data: number[]; stackTop: number; publics?: Record<string, number> }

function isPublics(value: unknown): value is Record<string, number> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    Object.entries(value).every(([key, address]) => /^(0|[1-9]\d*)$/.test(key) && Number(key) <= 0xffffffff &&
      typeof address === 'number' && Number.isSafeInteger(address) && address >= 0 && address % 4 === 0);
}

function isMemoryImage(value: unknown): value is MemoryImage {
  return typeof value === 'object' && value !== null &&
    'sha256' in value && typeof value.sha256 === 'string' &&
    (!('publics' in value) || isPublics(value.publics)) &&
    'data' in value && Array.isArray(value.data) && value.data.every((cell: unknown) => Number.isInteger(cell)) &&
    'stackTop' in value && typeof value.stackTop === 'number' && Number.isInteger(value.stackTop) && value.stackTop >= value.data.length * 4;
}

export function createLocalAmxMemoryLoader(request: (url: string) => Promise<Response> = fetch) {
  const cache = new Map<string, Promise<MemoryImage>>();
  return (file: string, sha256: string): Promise<MemoryImage> => {
    const key = `${file}:${sha256}`;
    const existing = cache.get(key);
    if (existing) return existing;
    const pending = request(`/assets/native/amx/${file}`).then(async response => {
      if (!response.ok) throw new Error(`Memória AMX ${file}: HTTP ${response.status}`);
      const image: unknown = await response.json();
      if (!isMemoryImage(image)) throw new Error(`Memória AMX ${file}: formato inválido`);
      if (image.sha256 !== sha256) throw new Error(`Memória AMX ${file}: SHA divergente`);
      return image;
    }).catch(error => { cache.delete(key); throw error; });
    cache.set(key, pending);
    return pending;
  };
}

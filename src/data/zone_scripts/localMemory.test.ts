import { describe, expect, it, vi } from 'vitest';
import { createLocalAmxMemoryLoader } from './localMemory';

const image = { sha256: 'synthetic', data: [0, -1, 2], stackTop: 32 };

describe('memória AMX incremental local', () => {
  it('carrega sob demanda uma imagem com SHA esperado e compartilha cache', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify(image)));
    const load = createLocalAmxMemoryLoader(request);
    const first = load('zone_synthetic_entities.json', 'synthetic');
    expect(load('zone_synthetic_entities.json', 'synthetic')).toBe(first);
    expect(await first).toEqual(image);
    expect(request).toHaveBeenCalledOnce();
  });
  it('rejeita SHA divergente sem guardar a falha', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify(image)));
    const load = createLocalAmxMemoryLoader(request);
    await expect(load('synthetic.json', 'different')).rejects.toThrow('SHA');
    await expect(load('synthetic.json', 'different')).rejects.toThrow('SHA');
    expect(request).toHaveBeenCalledTimes(2);
  });
  it.each([null, [], { 42: -4 }, { 42: 1 }, { invalid: 4 }])('rejeita metadados inválidos de exports: %j', async publics => {
    const load = createLocalAmxMemoryLoader(async () => new Response(JSON.stringify({ ...image, publics })));
    await expect(load('invalid-publics.json', 'synthetic')).rejects.toThrow('formato');
  });
  it('preserva exports locais sem exigir metadados de imagens legadas', async () => {
    const withPublics = { ...image, publics: { 42: 8 } };
    const load = createLocalAmxMemoryLoader(async () => new Response(JSON.stringify(withPublics)));
    expect(await load('publics.json', 'synthetic')).toEqual(withPublics);
  });
  it('não inventa memória quando asset está ausente ou inválido', async () => {
    const missing = createLocalAmxMemoryLoader(async () => new Response('', { status: 404 }));
    await expect(missing('missing.json', 'synthetic')).rejects.toThrow('HTTP 404');
    const invalid = createLocalAmxMemoryLoader(async () => new Response(JSON.stringify({ ...image, data: ['no'] })));
    await expect(invalid('invalid.json', 'synthetic')).rejects.toThrow('formato');
  });
});

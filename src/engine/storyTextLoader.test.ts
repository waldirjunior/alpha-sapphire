import { describe, expect, it, vi } from 'vitest';
import { createStoryTextLoader } from './storyTextLoader';

describe('bancos StoryText locais', () => {
  it('carrega arquivo local sob demanda e compartilha cache em voo', async () => {
    const fetchText = vi.fn(async () => new Response(JSON.stringify(['Linha sintética', ''])));
    const load = createStoryTextLoader(fetchText);
    const first = load(260);
    expect(load(260)).toBe(first);
    expect(await first).toEqual(['Linha sintética', '']);
    expect(fetchText).toHaveBeenCalledOnce();
    expect(fetchText).toHaveBeenCalledWith('/assets/texts/story/0260.json');
  });

  it('não guarda falha HTTP e permite repetir depois de gerar o asset', async () => {
    const fetchText = vi.fn().mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(['Sintético'])));
    const load = createStoryTextLoader(fetchText);
    await expect(load(23)).rejects.toThrow('23: HTTP 404');
    expect(await load(23)).toEqual(['Sintético']);
    expect(fetchText).toHaveBeenCalledTimes(2);
  });

  it('recusa JSON de outro formato, sem inventar linhas', async () => {
    const load = createStoryTextLoader(async () => new Response(JSON.stringify({ lines: ['Sintético'] })));
    await expect(load(1)).rejects.toThrow('array de textos');
  });
});

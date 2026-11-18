export function createStoryTextLoader(fetchText: (url: string) => Promise<Response> = fetch) {
  const cache = new Map<number, Promise<readonly string[]>>();
  return (file: number): Promise<readonly string[]> => {
    const existing = cache.get(file);
    if (existing) return existing;
    const pending = fetchText(`/assets/texts/story/${String(file).padStart(4, '0')}.json`).then(async response => {
      if (!response.ok) throw new Error(`MsgLoad StoryText ${file}: HTTP ${response.status}`);
      const lines: unknown = await response.json();
      if (!Array.isArray(lines) || !lines.every((line: unknown) => typeof line === 'string')) {
        throw new Error(`MsgLoad StoryText ${file}: esperado array de textos`);
      }
      return lines as readonly string[];
    }).catch(error => { cache.delete(file); throw error; });
    cache.set(file, pending);
    return pending;
  };
}

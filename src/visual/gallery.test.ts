import { describe, expect, it } from 'vitest';
import { galleryScore, renderGallery, type GalleryEntry } from './gallery';

const METRICS = { voidRatio: 0.126, avatarVisibility: 0.418, avatarScreenShare: 0.01, groundGap: 0.0859, failedAssets: 0 };

function entry(scenario: string, outcomes: readonly GalleryEntry['verdicts'][number][]): GalleryEntry {
  return { scenario, image: `captures/${scenario}.png`, metrics: METRICS, verdicts: outcomes };
}

const ACCEPTED = entry('z0007-oldale', [{ gate: 'avatarVisible', outcome: 'pass' }]);
const DEFECT = entry('z0006-telhado', [{ gate: 'avatarVisible', outcome: 'known-defect', pendencia: 'P-017 <telhado>' }]);

describe('visual gallery', () => {
  it('scores only scenarios whose gates all pass without registered defects', () => {
    expect(galleryScore([ACCEPTED, DEFECT])).toEqual({ accepted: 1, total: 2 });
  });

  it('renders the score, sorted cards and rounded metrics', () => {
    const html = renderGallery([ACCEPTED, DEFECT]);
    expect(html).toContain('Cenários aceitos: 1/2');
    expect(html.indexOf('z0006-telhado')).toBeLessThan(html.indexOf('z0007-oldale'));
    expect(html).toContain('avatar visível 42% · vazio 13% · folga pé-chão 0.086');
  });

  it('escapes text that comes from scenario records', () => {
    expect(renderGallery([DEFECT])).toContain('defeito conhecido (P-017 &lt;telhado&gt;)');
  });
});

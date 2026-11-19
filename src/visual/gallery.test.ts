import { describe, expect, it } from 'vitest';
import { galleryScore, renderGallery, scenarioPhase, type GalleryEntry } from './gallery';

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

  it('renders original emulator reference side-by-side only when present', () => {
    const withRef: GalleryEntry = { ...ACCEPTED, referenceImage: 'references/z0007-oldale.png' };
    const htmlWithRef = renderGallery([withRef]);
    expect(htmlWithRef).toContain('<div class="compare">');
    expect(htmlWithRef).toContain('<img src="captures/z0007-oldale.png" alt="z0007-oldale (port)" loading="lazy">');
    expect(htmlWithRef).toContain('<img src="references/z0007-oldale.png" alt="z0007-oldale (original)" loading="lazy">');

    const htmlWithoutRef = renderGallery([ACCEPTED]);
    expect(htmlWithoutRef).not.toContain('<div class="compare">');
    expect(htmlWithoutRef).toContain('<img src="captures/z0007-oldale.png" alt="z0007-oldale" loading="lazy">');
  });

  it('groups scenarios into phase tabs and tags each card with its phase', () => {
    expect(scenarioPhase('avatar-brendan')).toBe('avatars');
    expect(scenarioPhase('z0006-littleroot-spawn')).toBe('inicio');
    expect(scenarioPhase('z0016-rustboro')).toBe('oeste');
    expect(scenarioPhase('z0037-route111')).toBe('centro');
    expect(scenarioPhase('z0015-mauville-patio-upper-floor')).toBe('leste');
    expect(scenarioPhase('z0046-route119-bridge-upper-floor')).toBe('leste');

    const html = renderGallery([
      entry('avatar-brendan', [{ gate: 'avatarVisible', outcome: 'pass' }]),
      ACCEPTED,
      entry('z0046-route119-bridge-upper-floor', [{ gate: 'avatarVisible', outcome: 'pass' }]),
    ]);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('data-phase="all"');
    expect(html).toContain('data-phase="avatars"');
    expect(html).toContain('data-phase="inicio"');
    expect(html).toContain('data-phase="leste"');
    expect(html).toContain('<figure data-phase="avatars">');
    expect(html).toContain('<figure data-phase="leste">');
  });
});

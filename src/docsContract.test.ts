import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { VISUAL_SCENARIOS } from './visual/scenarios';

// A-096: a documentação de entrada precisa continuar curta e navegável para uma sessão conseguir começar.

const read = (file: string): string => readFileSync(path.resolve(file), 'utf8');

/** Arquivos que toda sessão lê antes de trabalhar, com o teto de caracteres de cada um. */
const ENTRY_DOCS: Readonly<Record<string, number>> = {
  'AGENTS.md': 10_000,
  'CLAUDE.md': 3_000,
  'docs/VISAO.md': 7_000,
  'docs/STATUS.md': 7_000,
  'docs/ROADMAP.md': 7_000,
};

function brokenLinks(file: string): string[] {
  const targets = [...read(file).matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]);
  return targets
    .filter((target) => !/^(https?:|mailto:|#)/.test(target))
    .map((target) => target.split('#')[0])
    .filter((target) => !existsSync(path.resolve(path.dirname(file), target)))
    .map((target) => `${file} → ${target}`);
}

function citedPendencias(text: string): string[] {
  return [...new Set(text.match(/\bP-\d{3}\b/g) ?? [])];
}

describe('documentação de entrada', () => {
  it('cabe no orçamento de leitura de cada arquivo', () => {
    const oversized = Object.entries(ENTRY_DOCS)
      .map(([file, limit]) => ({ file, size: read(file).length, limit }))
      .filter(({ size, limit }) => size > limit);
    expect(oversized).toEqual([]);
  });

  it('não tem links relativos quebrados', () => {
    const files = [...Object.keys(ENTRY_DOCS), 'README.md', 'docs/README.md', 'docs/features/README.md', 'docs/features/validacao-visual/README.md',
      'docs/SETUP.md', 'docs/features/validacao-emulador/setup-emulador.md', 'docs/features/validacao-emulador/prds/PRD-002-infraestrutura-do-oraculo.md'];
    expect(files.flatMap(brokenLinks)).toEqual([]);
  });

  it('cita apenas pendências que existem', () => {
    const known = new Set(read('docs/PENDENCIAS.md').match(/^## (P-\d{3})\b/gm)?.map((heading) => heading.slice(3)));
    const cited = citedPendencias(['docs/STATUS.md', 'docs/ROADMAP.md'].map(read).join('\n'))
      .concat(citedPendencias(VISUAL_SCENARIOS.flatMap((scenario) => Object.values(scenario.knownDefects)).join('\n')));
    expect(cited.filter((id) => !known.has(id))).toEqual([]);
  });

  it('mantém STATUS como retrato: sem seções datadas de entrega', () => {
    expect(read('docs/STATUS.md').match(/^## .*\b20\d\d-\d\d-\d\d\b.*$/gm) ?? []).toEqual([]);
  });
});

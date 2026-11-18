import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Regras de AGENTS.md que o compilador não verifica. Cada teste cita a regra que protege.

const SRC = path.resolve('src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

const relative = (file: string): string => path.relative(path.resolve('.'), file).split(path.sep).join('/');
const isTest = (file: string): boolean => file.endsWith('.test.ts') || file.includes(`${path.sep}testing${path.sep}`);
const FILES = sourceFiles(SRC);
const CORE_FILES = FILES.filter((file) => file.startsWith(path.join(SRC, 'core') + path.sep) && !isTest(file));

/** Remove comentários para que prosa como "o host usa window" não conte como uso. */
function code(file: string): string {
  return readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function offenders(files: readonly string[], pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(code(file))).map(relative);
}

describe('src/core permanece puro (core-jogo/ADR-001)', () => {
  it('não importa three nem o engine', () => {
    expect(offenders(CORE_FILES, /from\s+['"](three(\/[^'"]*)?|[^'"]*\/engine\/[^'"]*)['"]/)).toEqual([]);
  });

  it('não acessa APIs exclusivas de browser', () => {
    const browserGlobals = /\b(window|document|localStorage|sessionStorage|navigator|requestAnimationFrame|HTMLElement|AudioContext)\b/;
    expect(offenders(CORE_FILES, browserGlobals)).toEqual([]);
  });
});

describe('estilo de código (AGENTS.md)', () => {
  it('não usa any explícito', () => {
    // Este arquivo fica fora: o próprio padrão abaixo contém as formas proibidas.
    const scanned = FILES.filter((file) => relative(file) !== 'src/architecture.test.ts');
    expect(offenders(scanned, /(:\s*any\b|\bas\s+any\b|<any>|\bany\[\])/)).toEqual([]);
  });

  // Catraca: arquivos acima de 500 linhas ficam congelados no tamanho atual até serem divididos (P-020).
  const FROZEN_SIZES: Readonly<Record<string, number>> = { 'src/game.ts': 708 };

  it('mantém módulos em até 500 linhas, sem crescer os já excedentes', () => {
    const oversized = FILES.map((file) => ({ file: relative(file), lines: readFileSync(file, 'utf8').split('\n').length - 1 }))
      .filter(({ file, lines }) => lines > (FROZEN_SIZES[file] ?? 500));
    expect(oversized).toEqual([]);
  });

  it('não mantém na catraca um arquivo que já voltou ao limite', () => {
    const stale = Object.keys(FROZEN_SIZES).filter((file) => readFileSync(path.resolve(file), 'utf8').split('\n').length - 1 <= 500);
    expect(stale).toEqual([]);
  });
});

describe('propriedade intelectual da ROM (pipeline-rom/ADR-002)', () => {
  it('não versiona binários nem mídia derivados da ROM', () => {
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
    const proprietary = /\.(3ds|cia|cxi|cci|cfa|7z|zip|glb|gltf|bch|bin|garc|dae|png|jpe?g|webp|bcstm|bcsar|mp3|ogg|wav)$/i;
    expect(tracked.filter((file) => proprietary.test(file))).toEqual([]);
  });
});

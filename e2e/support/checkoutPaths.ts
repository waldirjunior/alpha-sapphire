import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Raiz do checkout principal: worktrees compartilham o `.git` dele, e é lá que ficam os assets e baselines locais. */
function mainCheckoutRoot(): string {
  const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
  return path.dirname(commonDir);
}

/** `public/` com os assets extraídos: o do próprio checkout, senão o do checkout principal. */
export function assetPublicDir(): string {
  if (process.env.ALPHA_PUBLIC_DIR) return process.env.ALPHA_PUBLIC_DIR;
  const local = path.resolve('public');
  return existsSync(path.join(local, 'assets')) ? local : path.join(mainCheckoutRoot(), 'public');
}

/** Imagens de referência derivam da ROM e não podem ir ao Git; ficam em `rom/` do checkout principal para valerem em todo worktree. */
export function visualBaselineDir(): string {
  return process.env.ALPHA_VISUAL_BASELINE_DIR ?? path.join(mainCheckoutRoot(), 'rom', 'visual-baselines');
}

/** Capturas de referência 400×240 tiradas no emulador; ficam em `rom/` do checkout principal. */
export function visualReferenceDir(): string {
  return process.env.ALPHA_VISUAL_REFERENCE_DIR ?? path.join(mainCheckoutRoot(), 'rom', 'visual-reference');
}

/** Capturas e relatórios da execução atual, por checkout. */
export function visualReportDir(): string {
  return path.resolve('rom', 'visual-report');
}

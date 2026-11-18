import { existsSync } from 'node:fs';
import path from 'node:path';
import { assetPublicDir } from './checkoutPaths';

export default function globalSetup(): void {
  const assets = path.join(assetPublicDir(), 'assets', 'native');
  if (existsSync(assets)) return;
  throw new Error(`Assets extraídos da ROM não encontrados em ${assets}. Rode o pipeline de staging (docs/tcc/01-pipeline-rom.md) ou aponte ALPHA_PUBLIC_DIR para um public/ que os tenha.`);
}

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderGallery, type GalleryEntry } from '../../src/visual/gallery';
import { visualReportDir } from './checkoutPaths';

export default function writeGallery(): void {
  const captures = path.join(visualReportDir(), 'captures');
  if (!existsSync(captures)) return;
  const entries = readdirSync(captures)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(path.join(captures, file), 'utf8')) as GalleryEntry);
  writeFileSync(path.join(visualReportDir(), 'index.html'), renderGallery(entries));
}

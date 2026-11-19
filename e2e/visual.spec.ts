import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { GalleryEntry } from '../src/visual/gallery';
import { evaluateGates, gateFailures, type GateVerdict } from '../src/visual/gates';
import { metricDrift, roundMetrics } from '../src/visual/metricsBaseline';
import type { ProbeMetrics, ProbeOutcome, ProbeReport } from '../src/visual/probeReport';
import { VISUAL_SCENARIOS, type VisualScenario } from '../src/visual/scenarios';
import { visualReferenceDir, visualReportDir } from './support/checkoutPaths';
import { trackPageErrors } from './support/pageErrors';

const METRICS_DIR = path.resolve('e2e', 'visual-metrics');
const CAPTURES_DIR = path.join(visualReportDir(), 'captures');
const REFERENCES_DIR = path.join(visualReportDir(), 'references');

async function runProbe(page: Page, scenario: VisualScenario): Promise<ProbeReport> {
  await page.goto(`/visual.html?scenario=${scenario.id}`);
  await page.waitForFunction(() => window.__visualProbe !== undefined, null, { timeout: 100_000 });
  const outcome = await page.evaluate(() => window.__visualProbe as ProbeOutcome);
  if (outcome.status === 'failed') throw new Error(`Probe ${scenario.id} falhou: ${outcome.error}`);
  return outcome.report;
}

async function saveCapture(page: Page, report: ProbeReport, verdicts: readonly GateVerdict[]): Promise<void> {
  mkdirSync(CAPTURES_DIR, { recursive: true });
  await page.locator('#app canvas').screenshot({ path: path.join(CAPTURES_DIR, `${report.scenario}.png`) });
  const sourceReference = path.join(visualReferenceDir(), `${report.scenario}.png`);
  let referenceImage: string | undefined;
  if (existsSync(sourceReference)) {
    mkdirSync(REFERENCES_DIR, { recursive: true });
    copyFileSync(sourceReference, path.join(REFERENCES_DIR, `${report.scenario}.png`));
    referenceImage = `references/${report.scenario}.png`;
  }
  const entry: GalleryEntry = {
    scenario: report.scenario,
    image: `captures/${report.scenario}.png`,
    ...(referenceImage ? { referenceImage } : {}),
    metrics: report.metrics,
    verdicts,
  };
  writeFileSync(path.join(CAPTURES_DIR, `${report.scenario}.json`), JSON.stringify(entry, null, 2));
}

/** Compara com o JSON versionado; `--update-snapshots` (ou baseline ausente) regrava. */
function versionedMetricDrift(scenario: VisualScenario, metrics: ProbeMetrics, testInfo: TestInfo): string[] {
  const file = path.join(METRICS_DIR, `${scenario.id}.json`);
  const mode = testInfo.config.updateSnapshots;
  if (mode === 'all' || mode === 'changed' || !existsSync(file)) {
    const created = !existsSync(file);
    mkdirSync(METRICS_DIR, { recursive: true });
    writeFileSync(file, `${JSON.stringify(roundMetrics(metrics), null, 2)}\n`);
    return created && mode === 'missing' ? [`baseline de métricas criado em ${file}; revise e rode de novo`] : [];
  }
  return metricDrift(JSON.parse(readFileSync(file, 'utf8')) as ProbeMetrics, metrics);
}

for (const scenario of VISUAL_SCENARIOS) {
  test(`visual ${scenario.id}`, async ({ page }, testInfo) => {
    const pageErrors = trackPageErrors(page);
    const report = await runProbe(page, scenario);
    const verdicts = evaluateGates(scenario, report.metrics);
    await saveCapture(page, report, verdicts);

    expect.soft(pageErrors, 'erros de página ou console').toEqual([]);
    expect.soft(gateFailures(verdicts), `portões de qualidade (assets com falha: ${report.failedAssetUrls.join(', ') || 'nenhum'})`).toEqual([]);
    expect.soft(versionedMetricDrift(scenario, report.metrics, testInfo), 'métricas versionadas').toEqual([]);
    await expect.soft(page.locator('#app canvas')).toHaveScreenshot(`${scenario.id}.png`);
  });
}

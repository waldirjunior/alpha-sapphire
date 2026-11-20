import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { GalleryEntry } from '../src/visual/gallery';
import { evaluateGates, gateFailures, type GateVerdict } from '../src/visual/gates';
import { metricDrift, roundMetrics } from '../src/visual/metricsBaseline';
import type { ProbeMetrics, ProbeOutcome, ProbeReport } from '../src/visual/probeReport';
import { POKENAV_MAP_SCENARIOS, VISUAL_SCENARIOS, type VisualScenario } from '../src/visual/scenarios';
import { visualReferenceDir, visualReportDir } from './support/checkoutPaths';
import { bootGame, finishIntro } from './support/game';
import { trackPageErrors } from './support/pageErrors';

const METRICS_DIR = path.resolve('e2e', 'visual-metrics');
const CAPTURES_DIR = path.join(visualReportDir(), 'captures');
const REFERENCES_DIR = path.join(visualReportDir(), 'references');
const POKENAV_REFERENCES_DIR = visualReferenceDir();

interface PokeNavMapMetrics {
  bottomScreenHeight: number;
  mapWidth: number;
  mapHeight: number;
  locationCount: number;
  connectionCount: number;
  playerMarkerCount: number;
  selectedLocationCount: number;
}

const POKENAV_METRIC_TOLERANCE: Record<keyof PokeNavMapMetrics, number> = {
  bottomScreenHeight: 2,
  mapWidth: 4,
  mapHeight: 2,
  locationCount: 0,
  connectionCount: 0,
  playerMarkerCount: 0,
  selectedLocationCount: 0,
};

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

function pokenavMetricDrift(baseline: PokeNavMapMetrics, current: PokeNavMapMetrics): string[] {
  return (Object.keys(POKENAV_METRIC_TOLERANCE) as (keyof PokeNavMapMetrics)[]).flatMap((name) => {
    const delta = current[name] - baseline[name];
    if (Math.abs(delta) <= POKENAV_METRIC_TOLERANCE[name]) return [];
    return [`${name}: ${baseline[name]} → ${current[name]} (Δ ${delta}, tolerância ±${POKENAV_METRIC_TOLERANCE[name]})`];
  });
}

function writePokeNavComparison(scenarioId: string, captureName: string, referenceName: string): void {
  const referenceFile = path.join(POKENAV_REFERENCES_DIR, referenceName);
  if (!existsSync(referenceFile)) return;
  mkdirSync(REFERENCES_DIR, { recursive: true });
  copyFileSync(referenceFile, path.join(REFERENCES_DIR, referenceName));
  const report = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${scenarioId} · Azahar</title>
<style>body{font:14px system-ui;margin:16px;background:#0f172a;color:#e2e8f0}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}figure{margin:0}img{max-width:100%;height:auto}figcaption{padding:8px 0}</style>
<h1>${scenarioId}</h1><main><figure><img src="captures/${captureName}" alt="Mapa do PokéNav no port"><figcaption>Port web</figcaption></figure>
<figure><img src="references/${referenceName}" alt="Tela do mapa capturada no Azahar"><figcaption>Azahar</figcaption></figure></main></html>`;
  writeFileSync(path.join(visualReportDir(), `${scenarioId}-comparison.html`), report);
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

for (const scenario of POKENAV_MAP_SCENARIOS) {
  test(`visual ${scenario.id}`, async ({ page }, testInfo) => {
    const pageErrors = trackPageErrors(page);
    await bootGame(page, 0.95);
    await finishIntro(page);
    await page.locator(`#ds-tabs [data-tab="${scenario.tab}"]`).click();
    const panel = page.locator('#ds-panel');
    await panel.locator(`[data-location-id="${scenario.selectedLocationId}"] circle`).click();

    const metrics = await page.locator('#bottom-screen').evaluate((bottom): PokeNavMapMetrics => {
      const bounds = (selector: string) => {
        const rect = bottom.querySelector(selector)?.getBoundingClientRect();
        return { width: Math.round(rect?.width ?? 0), height: Math.round(rect?.height ?? 0) };
      };
      const map = bounds('.hoenn-map-svg');
      return {
        bottomScreenHeight: Math.round(bottom.getBoundingClientRect().height),
        mapWidth: map.width,
        mapHeight: map.height,
        locationCount: bottom.querySelectorAll('.hoenn-map-location').length,
        connectionCount: bottom.querySelectorAll('.hoenn-map-route').length,
        playerMarkerCount: bottom.querySelectorAll('.hoenn-player-marker').length,
        selectedLocationCount: bottom.querySelectorAll('.hoenn-map-location.selected').length,
      };
    });
    const metricsFile = path.join(METRICS_DIR, `${scenario.id}.json`);
    const updateMetrics = testInfo.config.updateSnapshots === 'all' || testInfo.config.updateSnapshots === 'changed';
    const metricDriftMessages: string[] = [];
    if (updateMetrics || !existsSync(metricsFile)) {
      writeFileSync(metricsFile, `${JSON.stringify(metrics, null, 2)}\n`);
      if (!updateMetrics) metricDriftMessages.push(`baseline de métricas criado em ${metricsFile}; revise e rode de novo`);
    } else {
      const baseline = JSON.parse(readFileSync(metricsFile, 'utf8')) as typeof metrics;
      metricDriftMessages.push(...pokenavMetricDrift(baseline, metrics));
    }

    mkdirSync(CAPTURES_DIR, { recursive: true });
    const captureName = `${scenario.id}.png`;
    await page.locator('#bottom-screen').screenshot({ path: path.join(CAPTURES_DIR, captureName) });
    writePokeNavComparison(scenario.id, captureName, scenario.referenceImage);
    expect.soft(pageErrors, 'erros de página ou console').toEqual([]);
    expect.soft(metricDriftMessages, 'métricas do Mapa do PokéNav').toEqual([]);
    await expect.soft(panel).toHaveClass(/hoenn-map-open/);
    await expect.soft(panel.locator('.hoenn-map-details')).toContainText(scenario.selectedLocationName);
    await expect.soft(panel.locator('.hoenn-player-marker')).toHaveAttribute('aria-label', `Sua posição: ${scenario.playerLocationName}`);
    await expect.soft(panel.locator(`[data-location-id="${scenario.selectedLocationId}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect.soft(page.locator('#bottom-screen')).toHaveScreenshot(`${scenario.id}.png`);
  });
}

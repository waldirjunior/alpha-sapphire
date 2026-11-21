import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { POKEMON_BATTLE_SCENARIOS } from '../src/visual/scenarios';
import { bootGame, finishIntro, walk } from './support/game';
import { trackPageErrors } from './support/pageErrors';

const EXPRESSION_MODELS = [
  'zigzagoon', 'poochyena', 'torchic', 'treecko', 'mudkip', 'wurmple', 'lotad', 'ralts', 'taillow',
] as const;
const nativeAssets = JSON.parse(readFileSync(new URL('../src/data/nativeAssets.json', import.meta.url), 'utf8')) as {
  pokemon: Record<string, string>;
};

test('olhos, íris e expressão padrão estão presentes nos modelos Pokémon', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/');
  const models = EXPRESSION_MODELS.map(slug => ({ slug, url: nativeAssets.pokemon[slug] }));
  const inspection = await page.evaluate(async (assets) => {
    const expressionModulePath = '/src/engine/pokemonModelExpressions.ts';
    const { applyDefaultPokemonExpressions } = await import(expressionModulePath);
    const reports = [];
    for (const asset of assets) {
      const response = await fetch(asset.url);
      if (!response.ok) throw new Error(`GLB ${asset.slug} não carregou: HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      const view = new DataView(buffer);
      if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(16, true) !== 0x4e4f534a) {
        throw new Error(`GLB ${asset.slug} não possui um chunk JSON válido`);
      }
      const jsonLength = view.getUint32(12, true);
      const document = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
      const modelNodes = document.nodes.map((node) => ({ name: node.name ?? '', visible: true, mesh: node.mesh }));
      applyDefaultPokemonExpressions({ traverse: (visit) => modelNodes.forEach(visit) });
      const materials = document.materials.map((material) => material.name);
      const eyeMeshes = modelNodes.flatMap((node) => {
        if (node.mesh === undefined) return [];
        const mesh = document.meshes[node.mesh];
        return mesh.primitives.map((primitive) => materials[primitive.material])
          .filter((name) => name === 'Eye' || name === 'LIris' || name === 'RIris')
          .map((name) => ({ name, visible: node.visible }));
      });
      reports.push({
        slug: asset.slug,
        openMouth: modelNodes.filter((node) => /openmouth/i.test(node.name)).map((node) => node.visible),
        closeMouth: modelNodes.some((node) => /closemouth/i.test(node.name)),
        eyeMeshes,
      });
    }
    return reports;
  }, models);

  for (const report of inspection) {
    expect(report.eyeMeshes.some(mesh => mesh.name === 'Eye'), `${report.slug} Eye mesh`).toBe(true);
    expect(report.eyeMeshes.filter(mesh => mesh.name === 'Eye').every(mesh => mesh.visible)).toBe(true);
    if (report.closeMouth) expect(report.openMouth.every(visible => !visible)).toBe(true);
    if (report.slug === 'treecko' || report.slug === 'lotad') {
      expect(report.eyeMeshes.some(mesh => mesh.name === 'LIris'), `${report.slug} LIris mesh`).toBe(true);
      expect(report.eyeMeshes.some(mesh => mesh.name === 'RIris'), `${report.slug} RIris mesh`).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test('modelos de Pokémon renderizam textura nativa em batalha Torchic vs Poochyena', async ({ page }) => {
  const scenario = POKEMON_BATTLE_SCENARIOS.find(candidate => candidate.id === 'pokemon-battle-torchic-poochyena');
  if (!scenario) throw new Error('Cenário de batalha Torchic vs Poochyena ausente');
  const errors = trackPageErrors(page);
  await bootGame(page, 0.95);
  await finishIntro(page);
  await walk(page, 'ArrowUp', 1);
  await walk(page, 'ArrowUp', 4);
  await walk(page, 'ArrowLeft', 2);
  await walk(page, 'ArrowUp', 5);
  await page.keyboard.press('Enter');
  await expect(page.locator('#starter-bar')).toHaveClass(/debug-open/);

  const models = Promise.all([
    page.waitForResponse(response => response.url().includes('/assets/native/pokemon/torchic-') && response.status() === 200),
    page.waitForResponse(response => response.url().includes('/assets/native/pokemon/poochyena-') && response.status() === 200),
  ]);
  await page.locator(`#starter-bar [data-starter="${scenario.playerSpecies}"]`).click();
  await expect(page.locator('#battle-overlay')).toHaveClass(/open/);
  await expect(page.locator('#battle-player')).toContainText('Torchic');
  await expect(page.locator('#battle-enemy')).toContainText('Poochyena');
  await models;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: '/tmp/pokemon-fix-check.png' });
  await page.locator('#app canvas').screenshot({ path: '/tmp/pokemon-expression-idle.png' });
  const physicalMove = page.locator('#battle-actions button').first();
  await expect(physicalMove).toContainText('Scratch');
  await physicalMove.click();
  await page.waitForTimeout(1_050);
  await page.locator('#app canvas').screenshot({ path: '/tmp/pokemon-expression-attack.png' });
  expect(errors).toEqual([]);
});

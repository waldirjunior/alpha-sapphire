import { expect, test } from '@playwright/test';
import { POKEMON_BATTLE_SCENARIOS } from '../src/visual/scenarios';
import { bootGame, finishIntro, walk } from './support/game';
import { trackPageErrors } from './support/pageErrors';

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
  expect(errors).toEqual([]);
});

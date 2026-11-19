import { expect, test } from '@playwright/test';
import { bootGame, finishIntro, pressUntil, walk } from './support/game';
import { trackPageErrors } from './support/pageErrors';

const NO_ENCOUNTERS = 0.95;

test('New Game avança pela campanha natural até Birch', async ({ page }) => {
  const errors = trackPageErrors(page);
  await bootGame(page, NO_ENCOUNTERS);
  await finishIntro(page);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => page.locator('#hud-pos').textContent()).toContain('Route 101');
  await walk(page, 'ArrowUp', 4);
  await walk(page, 'ArrowLeft', 2);
  await walk(page, 'ArrowUp', 5);
  await page.keyboard.press('Enter');
  await expect(page.locator('#starter-bar')).toHaveClass(/debug-open/);
  await page.locator('#starter-bar [data-starter="mudkip"]').click();
  await expect(page.locator('#battle-overlay')).toHaveClass(/open/);
  await expect(page.locator('#battle-enemy')).toContainText('Poochyena');
  await expect(page.locator('#battle-player')).toContainText('Mudkip');
  const returnButton = page.getByRole('button', { name: 'Voltar ao mapa' });
  for (let attack = 0; attack < 8 && !(await returnButton.isVisible().catch(() => false)); attack += 1) {
    const previousLog = await page.locator('#battle-log').textContent();
    await page.locator('#battle-actions button').first().click();
    await expect(page.locator('#battle-log')).not.toHaveText(previousLog ?? '', { timeout: 30_000 });
  }
  await expect(returnButton).toBeVisible();
  await returnButton.click();
  await expect(page.locator('#battle-overlay')).not.toHaveClass(/open/);
  await walk(page, 'ArrowDown', 5);
  await walk(page, 'ArrowRight', 2);
  await walk(page, 'ArrowDown', 4);
  await pressUntil(page, 'ArrowDown', async () => ((await page.locator('#hud-pos').textContent()) ?? '').includes('Littleroot Town'), 4);
  await expect.poll(() => page.locator('#hud-pos').textContent(), { timeout: 10_000 }).toContain('Littleroot Town');
  await walk(page, 'ArrowRight', 2);
  await walk(page, 'ArrowDown', 24);
  await walk(page, 'ArrowLeft', 5);
  await walk(page, 'ArrowUp', 1);
  await expect.poll(() => page.locator('#hud-pos').textContent()).toContain('(13, 22)');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alpha_sapphire_web_save_v2') ?? 'null'));
  expect(saved.state.player.mapId).toBe('zone_0227');
  expect(saved.state.storyFlags.starter_chosen).toBe(true);
  expect(errors).toEqual([]);
});

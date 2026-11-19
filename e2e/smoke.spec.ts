import { expect, test } from '@playwright/test';
import { bootGame, dialogue, expectBlocked, expectHud, finishIntro, pressUntil, relocateSave, walk } from './support/game';
import { trackPageErrors } from './support/pageErrors';

const NO_ENCOUNTERS = 0.95;
const ALWAYS_ENCOUNTER = 0;
const START = 'Littleroot Town · Brendan (19, 0)';

test('novo jogo conclui a intro em Littleroot tocando a BGM da zona', async ({ page }) => {
  const errors = trackPageErrors(page);
  await bootGame(page, NO_ENCOUNTERS);
  await expect(page.locator('#intro-overlay')).toHaveClass(/open/);
  await finishIntro(page);
  await expectHud(page, START);
  await expect(page.locator('body')).toHaveAttribute('data-bgm', 'bgm_sg_t_01');
  expect(errors).toEqual([]);
});

test('movimento em grade anda um tile e para em um NPC', async ({ page }) => {
  const errors = trackPageErrors(page);
  await bootGame(page, NO_ENCOUNTERS);
  await finishIntro(page);
  await walk(page, 'ArrowDown', 1);
  await expectHud(page, 'Littleroot Town · Brendan (19, 1)');
  await expectBlocked(page, 'ArrowDown');
  await walk(page, 'ArrowRight', 2);
  await expectHud(page, 'Littleroot Town · Brendan (21, 1)');
  expect(errors).toEqual([]);
});

test('diálogo da ROM abre no NPC, fecha e devolve o controle', async ({ page }) => {
  const errors = trackPageErrors(page);
  await bootGame(page, NO_ENCOUNTERS);
  await finishIntro(page);
  await walk(page, 'ArrowDown', 1);
  await pressUntil(page, 'Enter', async () => ((await dialogue(page).textContent()) ?? '').includes('Are you off to catch Pokémon?'), 4);
  await expectBlocked(page, 'ArrowRight');
  await page.keyboard.press('Enter');
  await expect(dialogue(page)).toHaveText('');
  await walk(page, 'ArrowRight', 1);
  await expectHud(page, 'Littleroot Town · Brendan (20, 1)');
  expect(errors).toEqual([]);
});

test('porta leva ao interior e o save sobrevive ao reload', async ({ page }) => {
  const errors = trackPageErrors(page);
  await bootGame(page, NO_ENCOUNTERS);
  await finishIntro(page);
  await walk(page, 'ArrowDown', 1);
  await walk(page, 'ArrowRight', 1);
  await walk(page, 'ArrowDown', 11);
  await walk(page, 'ArrowLeft', 6);
  await expectHud(page, 'Littleroot Town · Brendan (14, 12)');
  await walk(page, 'ArrowUp', 1);
  await expectHud(page, 'Littleroot Town · Brendan (15, 18)');
  await page.reload();
  await expectHud(page, 'Littleroot Town · Brendan (15, 18)');
  await expect(page.locator('#intro-overlay')).not.toHaveClass(/open/);
  expect(errors).toEqual([]);
});

test('grama alta inicia batalha selvagem; golpe e fuga devolvem ao mapa', async ({ page }) => {
  const errors = trackPageErrors(page);
  await bootGame(page, ALWAYS_ENCOUNTER);
  await finishIntro(page);
  await relocateSave(page, 'zone_0023', 13, 4);
  await walk(page, 'ArrowRight', 1);
  const overlay = page.locator('#battle-overlay');
  await expect(overlay).toHaveClass(/open/);
  await expect(page.locator('#battle-enemy')).toContainText('Selvagem:');
  const logBefore = await page.locator('#battle-log').textContent();
  await page.locator('#battle-actions button').first().click();
  await expect(page.locator('#battle-log')).not.toHaveText(logBefore ?? '', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Fugir' }).click();
  await page.getByRole('button', { name: 'Voltar ao mapa' }).click();
  await expect(overlay).not.toHaveClass(/open/);
  await expectHud(page, 'Route 101 · Brendan (14, 4)');
  expect(errors).toEqual([]);
});

test('enfermeira Joy no Centro Pokémon cura a equipe ao interagir', async ({ page }) => {
  const errors = trackPageErrors(page);
  await bootGame(page, NO_ENCOUNTERS);
  await finishIntro(page);
  await page.evaluate(() => {
    const raw = window.localStorage.getItem('alpha_sapphire_web_save_v2');
    const save = JSON.parse(raw ?? 'null');
    save.state.activeDialogue = undefined;
    save.state.player = { ...save.state.player, mapId: 'zone_0228', pos: { x: 19, z: 16 }, facing: 'up' };
    save.party[0].currentHp = 2;
    window.localStorage.setItem('alpha_sapphire_web_save_v2', JSON.stringify(save));
  });
  await page.reload();
  await expectHud(page, 'Oldale Town · Brendan (19, 16)');
  await pressUntil(page, 'Enter', async () => ((await dialogue(page).textContent()) ?? '').includes('Enfermeira Joy:'), 5);
  await expect(dialogue(page)).toContainText('Enfermeira Joy:');
  const hpAfter = await page.evaluate(() => JSON.parse(window.localStorage.getItem('alpha_sapphire_web_save_v2') ?? 'null').party[0].currentHp);
  expect(hpAfter).toBeGreaterThan(2);
  expect(errors).toEqual([]);
});

test('PokéNav mostra o Mapa de Hoenn, posição atual e detalhes da rota selecionada', async ({ page }) => {
  const errors = trackPageErrors(page);
  await bootGame(page, NO_ENCOUNTERS);
  await finishIntro(page);
  await page.locator('#ds-tabs [data-tab="map"]').click();
  const panel = page.locator('#ds-panel');
  await expect(panel).toHaveClass(/hoenn-map-open/);
  await expect(panel.locator('.hoenn-map-svg')).toHaveAttribute('aria-label', 'Mapa interativo da região de Hoenn');
  await expect(panel.locator('.hoenn-player-marker')).toHaveAttribute('aria-label', 'Sua posição: Littleroot Town');
  await expect(panel.locator('.hoenn-map-details')).toContainText('Littleroot Town');
  await panel.locator('[data-location-id="route-101"] circle').click();
  await expect(panel.locator('.hoenn-map-details')).toContainText('Route 101');
  expect(errors).toEqual([]);
});

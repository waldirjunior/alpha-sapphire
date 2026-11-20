import { expect, test } from '@playwright/test';
import { bootGame, dialogue, finishIntro, pressUntil, walk } from './support/game';
import { corridorMap, corridorState, installCorridorNavigation, walkCorridorTo } from './support/corridorNavigation';
import { trackPageErrors } from './support/pageErrors';

const NO_ENCOUNTERS = 0.95;

async function advanceVisibleEventDialogues(page: Parameters<typeof bootGame>[0]): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const open = await dialogue(page).evaluate(element => element.classList.contains('open'));
    if (!open) return;
    await page.keyboard.press('Enter');
  }
  await expect(dialogue(page)).not.toHaveClass(/open/);
}

function expectHiddenSpawnFlags(flagIds: readonly number[], actors: NonNullable<Awaited<ReturnType<typeof corridorMap>>['npcs']>,
  flags: Readonly<Record<number, boolean>>): void {
  for (const flag of flagIds) {
    const matching = actors.filter(actor => actor.spawnFlag === flag);
    expect(matching.length, `mapa não contém spawnFlag ${flag}`).toBeGreaterThan(0);
    expect(flags[flag], `spawnFlag ${flag} ainda não está ativo`).toBe(true);
    expect(matching.every(actor => actor.visible === false), `spawnFlag ${flag} ainda está visível`).toBe(true);
  }
}

test('New Game avança naturalmente de Birch até Rustboro sem NPCs futuros duplicados', async ({ page }) => {
  test.setTimeout(300_000);
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
  await advanceVisibleEventDialogues(page);
  await installCorridorNavigation(page);
  const labState = await corridorState(page);
  expect(labState.player.mapId).toBe('zone_0227');
  expect(labState.storyFlags.starter_chosen).toBe(true);
  expect(labState.romEvents?.flags).toMatchObject({ 612: true, 824: true, 825: true });

  await walk(page, 'ArrowUp', 1);
  await walk(page, 'ArrowDown', 1);
  await advanceVisibleEventDialogues(page);
  await walkCorridorTo(page, 'zone_0023');
  await advanceVisibleEventDialogues(page);
  await expect.poll(() => page.locator('#hud-pos').textContent()).toContain('Route 101');
  const littleroot = await corridorMap(page, 'zone_0006');
  const campaignFlags = labState.romEvents?.flags ?? {};
  expectHiddenSpawnFlags([824, 825], littleroot.npcs ?? [], campaignFlags);
  const route101 = await corridorMap(page, 'zone_0023');
  expectHiddenSpawnFlags([533, 534, 535, 603, 778, 779, 781], route101.npcs ?? [], campaignFlags);
  expect(campaignFlags[780]).not.toBe(true);
  expect(campaignFlags[602]).not.toBe(true);

  await walkCorridorTo(page, 'zone_0007');
  await advanceVisibleEventDialogues(page);
  await expect.poll(() => page.locator('#hud-pos').textContent()).toContain('Oldale Town');
  const oldale = await corridorMap(page, 'zone_0007');
  expectHiddenSpawnFlags([619], oldale.npcs ?? [], campaignFlags);

  await walkCorridorTo(page, 'zone_0024');
  await advanceVisibleEventDialogues(page);
  await expect.poll(() => page.locator('#hud-pos').textContent()).toContain('Route 102');
  const route102 = await corridorMap(page, 'zone_0024');
  expectHiddenSpawnFlags([618, 725], route102.npcs ?? [], campaignFlags);
  const route102State = await corridorState(page);
  expect(route102State.player.mapId).toBe('zone_0024');

  const petalburgSteps = await walkCorridorTo(page, 'zone_0013');
  expect(petalburgSteps).toBeGreaterThan(0);
  await advanceVisibleEventDialogues(page);
  await expect.poll(() => page.locator('#hud-pos').textContent(), { timeout: 10_000 }).toContain('Petalburg City');
  const petalburgState = await corridorState(page);
  expect(petalburgState.player.mapId).toBe('zone_0013');
  expect(petalburgState.romEvents?.flags).toMatchObject({ 618: true, 725: true, 773: true });
  expect(petalburgState.romEvents?.flags[774]).not.toBe(true);
  const petalburg = await corridorMap(page, 'zone_0013');
  expectHiddenSpawnFlags([773], petalburg.npcs ?? [], petalburgState.romEvents?.flags ?? {});
  expect(petalburgState.romEvents?.vars).toEqual(route102State.romEvents?.vars);

  const route104SouthSteps = await walkCorridorTo(page, 'zone_0027');
  expect(route104SouthSteps).toBeGreaterThan(0);
  await advanceVisibleEventDialogues(page);
  expect((await corridorState(page)).player.mapId).toBe('zone_0027');
  expect((await corridorMap(page, 'zone_0027')).name).toBe('Route 104');

  const woodsSteps = await walkCorridorTo(page, 'zone_0082');
  expect(woodsSteps).toBeGreaterThan(0);
  await advanceVisibleEventDialogues(page);
  const woodsState = await corridorState(page);
  expect(woodsState.player.mapId).toBe('zone_0082');
  expect((await corridorMap(page, 'zone_0082')).name).toBe('Petalburg Woods');
  expectHiddenSpawnFlags([624, 706, 1066], (await corridorMap(page, 'zone_0082')).npcs ?? [],
    woodsState.romEvents?.flags ?? {});

  const route104NorthSteps = await walkCorridorTo(page, 'zone_0026');
  expect(route104NorthSteps).toBeGreaterThan(0);
  await advanceVisibleEventDialogues(page);
  const route104NorthState = await corridorState(page);
  expect(route104NorthState.player.mapId).toBe('zone_0026');
  expect((await corridorMap(page, 'zone_0026')).name).toBe('Route 104');
  expectHiddenSpawnFlags([826], (await corridorMap(page, 'zone_0026')).npcs ?? [],
    route104NorthState.romEvents?.flags ?? {});

  const rustboroSteps = await walkCorridorTo(page, 'zone_0016');
  expect(rustboroSteps).toBeGreaterThan(0);
  await advanceVisibleEventDialogues(page);
  expect((await corridorState(page)).player.mapId).toBe('zone_0016');
  await expect.poll(() => page.locator('#hud-pos').textContent(), { timeout: 10_000 }).toContain('Rustboro City');
  expect(errors).toEqual([]);
});

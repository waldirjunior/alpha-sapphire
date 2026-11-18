import { expect, type Page } from '@playwright/test';

export const SAVE_KEY = 'alpha_sapphire_web_save_v2';

const hud = (page: Page) => page.locator('#hud-pos');
export const dialogue = (page: Page) => page.locator('#dialogue-box');

/** `random` fixa o Math.random do jogo: 0.95 nunca dispara encontro selvagem, 0 sempre dispara. */
export async function bootGame(page: Page, random: number): Promise<void> {
  await page.addInitScript((value) => { Math.random = () => value; }, random);
  await page.goto('/');
  await expect(hud(page)).toContainText('(');
}

export async function finishIntro(page: Page): Promise<void> {
  await page.locator('#intro-next').click();
  // O cartão do caminhão treme por animação CSS e nunca fica "estável" para o clique padrão.
  await page.locator('#intro-finish').click({ force: true });
  await expect(page.locator('#intro-overlay')).not.toHaveClass(/open/);
}

export async function expectHud(page: Page, text: string): Promise<void> {
  await expect(hud(page)).toHaveText(text);
}

const STEP_ATTEMPTS = 4;

async function hudChanged(page: Page, before: string): Promise<boolean> {
  return expect(hud(page)).not.toHaveText(before, { timeout: 1500 }).then(() => true, () => false);
}

/**
 * Um passo que precisa mudar o HUD. O jogo descarta teclas enquanto a zona inicializa eventos,
 * então a tecla é repetida só enquanto o estado não mudou; falha se o jogador ficar parado.
 */
async function step(page: Page, key: string): Promise<void> {
  const before = (await hud(page).textContent()) ?? '';
  for (let attempt = 0; attempt < STEP_ATTEMPTS; attempt += 1) {
    await page.keyboard.press(key);
    if (await hudChanged(page, before)) return;
  }
  throw new Error(`Jogador não saiu de "${before}" após ${STEP_ATTEMPTS}× ${key}`);
}

export async function walk(page: Page, key: string, steps: number): Promise<void> {
  for (let taken = 0; taken < steps; taken += 1) await step(page, key);
}

/** Um passo contra obstáculo: dá tempo ao movimento assíncrono e exige o mesmo HUD. */
export async function expectBlocked(page: Page, key: string): Promise<void> {
  const before = (await hud(page).textContent()) ?? '';
  await page.keyboard.press(key);
  await page.waitForTimeout(600);
  await expectHud(page, before);
}

export async function pressUntil(page: Page, key: string, done: () => Promise<boolean>, maxPresses: number): Promise<void> {
  for (let pressed = 0; pressed < maxPresses; pressed += 1) {
    if (await done()) return;
    await page.keyboard.press(key);
    await page.waitForTimeout(450);
  }
  expect(await done(), `condição não atingida após ${maxPresses}× ${key}`).toBe(true);
}

/** Reposiciona o jogador editando o save real gravado pelo jogo; não fabrica party, bolsa nem flags. */
export async function relocateSave(page: Page, mapId: string, x: number, z: number): Promise<void> {
  await page.evaluate(([key, map, px, pz]) => {
    const save = JSON.parse(window.localStorage.getItem(key as string) ?? 'null');
    save.state.player = { ...save.state.player, mapId: map, pos: { x: px, z: pz } };
    window.localStorage.setItem(key as string, JSON.stringify(save));
  }, [SAVE_KEY, mapId, x, z] as const);
  await page.reload();
  await expect(hud(page)).toContainText(`(${x}, ${z})`);
}

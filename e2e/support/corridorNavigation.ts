import { expect, type Page } from '@playwright/test';
import type { Direction, GameState, GridPosition, MapDefinition, PlayerState } from '../../src/core/types';
import { SAVE_KEY } from './game';

type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

export interface CorridorStep {
  key: ArrowKey;
  from: PlayerState;
  to: PlayerState;
  warp: boolean;
  worldFrom: GridPosition;
  worldTo: GridPosition;
}

export interface CorridorNavigationApi {
  plan(targetMapId: string, point: GridPosition | null): Promise<CorridorStep[] | null>;
  readState(): GameState;
  readMap(mapId: string): Promise<MapDefinition>;
}

declare global {
  interface Window {
    __corridorNavigation?: CorridorNavigationApi;
  }
}

const STEP_RETRIES = 5;
const STEP_TIMEOUT = 1_200;

export async function installCorridorNavigation(page: Page): Promise<void> {
  await page.evaluate(async (saveKey) => {
    const modulePaths = [
      '/src/data/maps_v2/runtime.ts',
      '/src/core/gameState.ts',
      '/src/core/warps.ts',
      '/src/core/boundaries.ts',
    ];
    const directionKeys: Record<Direction, ArrowKey> = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };
    type BrowserPlayer = PlayerState;
    type BrowserMap = MapDefinition;
    type BrowserState = GameState;
    type BrowserPoint = GridPosition;

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    const moduleUrl = (path: string): string => {
      const entry = performance.getEntriesByType('resource').find((resource) => new URL(resource.name).pathname === path);
      return entry?.name ?? path;
    };
    const isMap = (value: unknown): value is BrowserMap =>
      isRecord(value) && typeof value.id === 'string' && typeof value.width === 'number' &&
      typeof value.height === 'number' && Array.isArray(value.collisions) && Array.isArray(value.warps);
    const isState = (value: unknown): value is BrowserState => {
      if (!isRecord(value) || !isRecord(value.player) || !isRecord(value.storyFlags)) return false;
      const player = value.player;
      const position = player.pos;
      if (!isRecord(position)) return false;
      return typeof player.mapId === 'string' && typeof position.x === 'number' && typeof position.z === 'number' &&
        ['up', 'down', 'left', 'right'].includes(String(player.facing)) &&
        Object.values(value.storyFlags).every((flag) => typeof flag === 'boolean');
    };
    const readState = (): BrowserState => {
      const raw = localStorage.getItem(saveKey);
      const save: unknown = raw ? JSON.parse(raw) : null;
      if (!isRecord(save) || !isState(save.state)) throw new Error(`Save ${saveKey} inválido para o corredor`);
      return save.state;
    };

    const [runtimeValue, gameStateValue, warpsValue, boundariesValue] = await Promise.all(
      modulePaths.map(async (path): Promise<unknown> => import(moduleUrl(path)))
    );
    if (!isRecord(runtimeValue) || !isRecord(runtimeValue.zoneMaps)) throw new Error('zoneMaps não exportado pelo runtime');
    const repositoryValue = runtimeValue.zoneMaps;
    if (!isRecord(repositoryValue.maps) || typeof repositoryValue.load !== 'function' ||
        !Object.values(repositoryValue.maps).every(isMap)) throw new Error('Repositório de zonas inválido');
    const repository = repositoryValue as unknown as {
      maps: Record<string, BrowserMap>;
      load(id: string): Promise<BrowserMap>;
    };
    const requireFunction = <T,>(value: unknown, name: string): T => {
      if (!isRecord(value) || typeof value[name] !== 'function') throw new Error(`Função ${name} ausente no módulo do corredor`);
      return value[name] as T;
    };
    const movePlayer = requireFunction<typeof import('../../src/core/gameState').movePlayer>(gameStateValue, 'movePlayer');
    const stepWarp = requireFunction<typeof import('../../src/core/warps').stepWarp>(warpsValue, 'stepWarp');
    const worldPosition = requireFunction<typeof import('../../src/core/boundaries').worldPosition>(boundariesValue, 'worldPosition');

    const identify = (player: BrowserPlayer): string => `${player.mapId}:${player.pos.x}:${player.pos.z}`;
    const plan = async (targetMapId: string, point: BrowserPoint | null): Promise<CorridorStep[] | null> => {
      const start = readState();
      await repository.load(start.player.mapId);
      await repository.load(targetMapId);
      const startId = identify(start.player);
      const queue: BrowserPlayer[] = [start.player];
      const previous = new Map<string, { id: string; step: CorridorStep } | null>([[startId, null]]);
      let destination: string | undefined;

      for (let index = 0; index < queue.length; index += 1) {
        const player = queue[index];
        const currentId = identify(player);
        if (player.mapId === targetMapId && (!point || (player.pos.x === point.x && player.pos.z === point.z))) {
          destination = currentId;
          break;
        }
        const map = repository.maps[player.mapId];
        if (!map) throw new Error(`Mapa ${player.mapId} não carregado pelo repositório`);

        for (const direction of ['up', 'down', 'left', 'right'] as const) {
          const current = { ...start, player };
          const next = movePlayer(current, direction, repository.maps);
          const nextId = identify(next.player);
          if (previous.has(nextId) || ![start.player.mapId, targetMapId].includes(next.player.mapId)) continue;
          const warp = stepWarp(current, direction, map);
          previous.set(nextId, {
            id: currentId,
            step: {
              key: directionKeys[direction],
              from: player,
              to: next.player,
              warp: Boolean(warp),
              worldFrom: worldPosition(player.pos, map),
              worldTo: worldPosition(next.player.pos, repository.maps[next.player.mapId] ?? map),
            },
          });
          queue.push(next.player);
        }
      }

      if (!destination) return null;
      const path: CorridorStep[] = [];
      for (let current = destination; previous.get(current);) {
        const node = previous.get(current);
        if (!node) break;
        path.push(node.step);
        current = node.id;
      }
      return path.reverse();
    };

    const readMap = async (mapId: string): Promise<BrowserMap> => repository.load(mapId);
    window.__corridorNavigation = { plan, readState, readMap };
  }, SAVE_KEY);
}

export async function corridorState(page: Page): Promise<GameState> {
  return page.evaluate(() => {
    if (!window.__corridorNavigation) throw new Error('Runtime de navegação do corredor não instalado');
    return window.__corridorNavigation.readState();
  });
}

export async function corridorMap(page: Page, mapId: string): Promise<MapDefinition> {
  return page.evaluate(async (id) => {
    if (!window.__corridorNavigation) throw new Error('Runtime de navegação do corredor não instalado');
    return window.__corridorNavigation.readMap(id);
  }, mapId);
}

export async function corridorPath(
  page: Page,
  targetMapId: string,
  point: GridPosition | null = null
): Promise<CorridorStep[] | null> {
  return page.evaluate(async ({ target, destination }) => {
    if (!window.__corridorNavigation) throw new Error('Runtime de navegação do corredor não instalado');
    return window.__corridorNavigation.plan(target, destination);
  }, { target: targetMapId, destination: point });
}

export async function walkCorridorTo(
  page: Page,
  targetMapId: string,
  point: GridPosition | null = null
): Promise<number> {
  let path = await corridorPath(page, targetMapId, point);
  if (!path) throw new Error(`Nenhum caminho desde o estado atual até ${targetMapId}/${JSON.stringify(point)}`);
  let cursor = 0;
  let movements = 0;
  while (cursor < path.length) {
    const exactStep = await executeCorridorStep(page, path[cursor]);
    movements += 1;
    if (exactStep) {
      cursor += 1;
      continue;
    }
    path = await corridorPath(page, targetMapId, point);
    if (!path) throw new Error(`Caminho perdido após movimento inesperado até ${targetMapId}/${JSON.stringify(point)}`);
    cursor = 0;
  }
  return movements;
}

export async function expectCorridorBlocked(page: Page, key: ArrowKey, attempts = 2): Promise<void> {
  const before = await corridorState(page);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
    const after = await corridorState(page);
    expect(after.player.mapId).toBe(before.player.mapId);
    expect(after.player.pos).toEqual(before.player.pos);
  }
}

export async function reloadCorridor(page: Page): Promise<void> {
  await page.reload();
  await expect(page.locator('#intro-overlay')).not.toHaveClass(/open/);
  await expect(page.locator('#hud-pos')).toContainText('(');
  await installCorridorNavigation(page);
}

async function executeCorridorStep(page: Page, step: CorridorStep): Promise<boolean> {
  for (let attempt = 0; attempt < STEP_RETRIES; attempt += 1) {
    await page.keyboard.press(step.key);
    const changed = await page.waitForFunction(({ saveKey, from }) => {
      const raw = localStorage.getItem(saveKey);
      if (!raw) return false;
      const saved: unknown = JSON.parse(raw);
      if (saved === null || typeof saved !== 'object' || !('state' in saved)) return false;
      const state: unknown = saved.state;
      if (state === null || typeof state !== 'object' || !('player' in state)) return false;
      const player: unknown = state.player;
      if (player === null || typeof player !== 'object' || !('mapId' in player) || !('pos' in player)) return false;
      const position: unknown = player.pos;
      return position !== null && typeof position === 'object' && 'x' in position && 'z' in position &&
        (player.mapId !== from.mapId || position.x !== from.pos.x || position.z !== from.pos.z);
    }, { saveKey: SAVE_KEY, from: step.from }, { timeout: STEP_TIMEOUT, polling: 'raf' }).then(() => true, () => false);
    if (!changed) continue;
    const actual = (await corridorState(page)).player;
    const exactStep = actual.mapId === step.to.mapId && actual.pos.x === step.to.pos.x && actual.pos.z === step.to.pos.z;
    if (!exactStep) return false;
    await validateCorridorTransition(page, step);
    return true;
  }
  throw new Error(`Movimento ${step.key} não avançou desde ${JSON.stringify(step.from)}`);
}

async function validateCorridorTransition(page: Page, step: CorridorStep): Promise<void> {
  if (step.from.mapId === step.to.mapId) return;
  if (!step.warp) {
    const distance = Math.abs(step.worldTo.x - step.worldFrom.x) + Math.abs(step.worldTo.z - step.worldFrom.z);
    expect(distance, `${step.from.mapId} → ${step.to.mapId} deve avançar um tile mundial`).toBe(1);
  }
  await page.waitForFunction(() => [...document.querySelectorAll('#app, canvas')]
    .every((element) => Number(getComputedStyle(element).opacity) === 1), null, { timeout: 5_000, polling: 'raf' });
}

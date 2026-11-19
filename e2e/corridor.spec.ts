import { expect, test } from '@playwright/test';
import { applyCorridorFixture, installCorridorFixtures } from './support/corridorFixtures';
import {
  corridorMap,
  corridorPath,
  corridorState,
  expectCorridorBlocked,
  installCorridorNavigation,
  reloadCorridor,
  walkCorridorTo,
} from './support/corridorNavigation';
import { bootGame, finishIntro } from './support/game';
import { trackPageErrors } from './support/pageErrors';

const NO_ENCOUNTERS = 0.95;
const GATE_FLAG_IDS = {
  rockSmash: [2, 3, 4, 5],
  rusturf: [12, 13, 14],
  route110: [9, 10, 11, 12, 13],
} as const;

test('corredor de Littleroot a Lavaridge preserva mapas, warps e fixtures pós-evento', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = trackPageErrors(page);
  page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()}`));
  let movementSteps = 0;

  await bootGame(page, NO_ENCOUNTERS);
  await finishIntro(page);
  await expect(page.locator('#hud-pos')).toHaveText('Littleroot Town · Brendan (19, 0)');
  await installRuntime(page);

  movementSteps += await walkSequence(page, ['zone_0023', 'zone_0007', 'zone_0024']);
  movementSteps += await walkCorridorTo(page, 'zone_0013', { x: 1, z: 48 });
  movementSteps += await walkSequence(page, ['zone_0027', 'zone_0082', 'zone_0026']);
  movementSteps += await walkCorridorTo(page, 'zone_0016', { x: 47, z: 65 });

  movementSteps += await walkSequence(page, ['zone_0043', 'zone_0075']);
  movementSteps += await walkCorridorTo(page, 'zone_0075', { x: 50, z: 11 });
  await expectBlockedRoute(page, 'zone_0011', 'ArrowRight');
  const rusturfFixture = await applyCorridorFixture(page, 'applyRusturfClear');
  expect(rusturfFixture.flag676).toBe(true);
  expect(rusturfFixture.deleted).toEqual(expect.arrayContaining(GATE_FLAG_IDS.rusturf.map((id) => `75:${id}`)));
  await reloadAndInstall(page);
  await expectPlayerAt(page, 'zone_0075', 50, 11);
  await expectGate(page, 'zone_0075', 676, false);
  movementSteps += await walkCorridorTo(page, 'zone_0011', { x: 16, z: 22 });

  movementSteps += await walkSequence(page, ['zone_0044', 'zone_0445', 'zone_0015']);
  movementSteps += await walkCorridorTo(page, 'zone_0015', { x: 17, z: 22 });
  movementSteps += await walkSequence(page, ['zone_0445', 'zone_0033']);
  movementSteps += await walkCorridorTo(page, 'zone_0033', { x: 16, z: 115 });
  await expectBlockedRoute(page, 'zone_0014', 'ArrowDown');
  const route110Fixture = await applyCorridorFixture(page, 'applyRoute110Clear');
  expect(route110Fixture.flag660).toBe(true);
  expect(route110Fixture.work16526).toBe(2);
  expect(route110Fixture.deleted).toEqual(expect.arrayContaining(GATE_FLAG_IDS.route110.map((id) => `33:${id}`)));
  await reloadAndInstall(page);
  await expectPlayerAt(page, 'zone_0033', 16, 115);
  expect((await corridorState(page)).romEvents?.vars[16526]).toBe(2);
  await expectGate(page, 'zone_0033', 660, false);
  movementSteps += await walkCorridorTo(page, 'zone_0014', { x: 31, z: 22 });

  movementSteps += await walkSequence(page, ['zone_0033', 'zone_0445', 'zone_0015', 'zone_0445', 'zone_0037']);
  movementSteps += await walkCorridorTo(page, 'zone_0037', { x: 31, z: 66 });
  await expectBlockedRoute(page, 'zone_0039', 'ArrowUp');
  const rockSmashFixture = await applyCorridorFixture(page, 'applyDerivedRockSmash');
  expect(rockSmashFixture.playerUnchanged).toBe(true);
  expect(rockSmashFixture.flagsUnchanged).toBe(true);
  expect(rockSmashFixture.deleted).toEqual(expect.arrayContaining(GATE_FLAG_IDS.rockSmash.map((id) => `37:${id}`)));
  await reloadAndInstall(page);
  await expectPlayerAt(page, 'zone_0037', 31, 66);
  await expectScriptGate(page, 'zone_0037', 10050, false);

  movementSteps += await walkCorridorTo(page, 'zone_0039', { x: 55, z: 29 });
  await expectBlockedRoute(page, 'zone_0384', 'ArrowUp');
  await expectGate(page, 'zone_0039', 666, true);
  const flag666Fixture = await applyCorridorFixture(page, 'applyFlag666');
  expect(flag666Fixture.flag666).toBe(true);
  expect(flag666Fixture.playerUnchanged).toBe(true);
  await reloadAndInstall(page);
  await expectPlayerAt(page, 'zone_0039', 55, 29);
  await expectGate(page, 'zone_0039', 666, false);

  movementSteps += await walkSequence(page, ['zone_0085', 'zone_0038', 'zone_0036', 'zone_0040', 'zone_0010']);
  movementSteps += await walkCorridorTo(page, 'zone_0010', { x: 20, z: 22 });
  movementSteps += await walkSequence(page, ['zone_0041', 'zone_0071']);
  movementSteps += await walkCorridorTo(page, 'zone_0071', { x: 51, z: 32 });
  for (const exit of ['zone_0042', 'zone_0072', 'zone_0073']) expect(await corridorPath(page, exit)).toBeNull();
  expect((await corridorMap(page, 'zone_0071')).collisions[32]?.[50]).toBe(1);
  await expectCorridorBlocked(page, 'ArrowLeft');
  await reloadAndInstall(page);
  await expectPlayerAt(page, 'zone_0071', 51, 32);

  movementSteps += await walkSequence(page, [
    'zone_0041', 'zone_0010', 'zone_0040', 'zone_0036', 'zone_0038', 'zone_0085', 'zone_0039',
  ]);
  movementSteps += await walkCorridorTo(page, 'zone_0384', { x: 15, z: 25 });
  const transportFixture = await applyCorridorFixture(page, 'applyCableCarTransport');
  expect(transportFixture.sourceMapId).toBe('zone_0384');
  expect(transportFixture.destinationMapId).toBe('zone_0385');
  expect(transportFixture.destination.pos).toEqual({ x: 23, z: 18 });
  expect(transportFixture.work16699).toBe(1);
  await reloadAndInstall(page);
  await expectPlayerAt(page, 'zone_0385', 23, 18);
  expect((await corridorState(page)).romEvents?.vars[16699]).toBe(1);
  const upperStation = await corridorMap(page, 'zone_0385');
  expect(upperStation.npcs?.find((npc) => npc.id === 'zone_0385:npc:1')).toMatchObject({
    pos: { x: 24, z: 18 }, visible: true,
  });

  movementSteps += await walkSequence(page, ['zone_0083', 'zone_0084']);
  movementSteps += await walkCorridorTo(page, 'zone_0084', { x: 38, z: 29 });
  await page.keyboard.press('ArrowDown');
  await expectPlayerAt(page, 'zone_0084', 38, 31);
  await expectCorridorBlocked(page, 'ArrowUp');
  movementSteps += await walkSequence(page, ['zone_0039', 'zone_0009']);
  movementSteps += await walkCorridorTo(page, 'zone_0009', { x: 20, z: 21 });
  const finalState = await corridorState(page);
  expect(finalState.player).toMatchObject({ mapId: 'zone_0009', pos: { x: 20, z: 21 } });
  expect(finalState.storyFlags['amx:flag:666']).toBe(true);
  expect(finalState.storyFlags['amx:flag:676']).toBe(true);
  expect(finalState.storyFlags['amx:flag:660']).toBe(true);
  expect(finalState.romEvents?.vars[16526]).toBe(2);
  expect(finalState.romEvents?.vars[16699]).toBe(1);
  expect(Object.keys(finalState.storyFlags).filter((key) => key.startsWith('amx:deleted:37:'))).toHaveLength(4);
  expect(Object.keys(finalState.storyFlags).filter((key) => key.startsWith('amx:deleted:75:'))).toHaveLength(3);
  expect(Object.keys(finalState.storyFlags).filter((key) => key.startsWith('amx:deleted:33:'))).toHaveLength(5);

  await reloadAndInstall(page);
  expect((await corridorState(page)).player).toMatchObject({ mapId: 'zone_0009', pos: { x: 20, z: 21 } });
  expect(movementSteps).toBeGreaterThan(500);
  expect(errors).toEqual([]);
});

async function installRuntime(page: Parameters<typeof installCorridorNavigation>[0]): Promise<void> {
  await installCorridorNavigation(page);
  await installCorridorFixtures(page);
}

async function reloadAndInstall(page: Parameters<typeof installCorridorNavigation>[0]): Promise<void> {
  await reloadCorridor(page);
  await installCorridorFixtures(page);
}

async function walkSequence(page: Parameters<typeof walkCorridorTo>[0], mapIds: string[]): Promise<number> {
  let steps = 0;
  for (const mapId of mapIds) steps += await walkCorridorTo(page, mapId);
  return steps;
}

async function expectBlockedRoute(
  page: Parameters<typeof corridorPath>[0],
  targetMapId: string,
  key: Parameters<typeof expectCorridorBlocked>[1]
): Promise<void> {
  expect(await corridorPath(page, targetMapId)).toBeNull();
  await expectCorridorBlocked(page, key);
}

async function expectPlayerAt(
  page: Parameters<typeof corridorState>[0],
  mapId: string,
  x: number,
  z: number
): Promise<void> {
  expect((await corridorState(page)).player).toMatchObject({ mapId, pos: { x, z } });
}

async function expectGate(
  page: Parameters<typeof corridorMap>[0],
  mapId: string,
  spawnFlag: number,
  visible: boolean
): Promise<void> {
  const gate = (await corridorMap(page, mapId)).npcs?.filter((npc) => npc.spawnFlag === spawnFlag) ?? [];
  expect(gate.length, `NPCs spawnFlag=${spawnFlag} em ${mapId}`).toBeGreaterThan(0);
  expect(gate.every((npc) => (npc.visible !== false) === visible)).toBe(true);
}

async function expectScriptGate(
  page: Parameters<typeof corridorMap>[0],
  mapId: string,
  scriptId: number,
  visible: boolean
): Promise<void> {
  const gate = (await corridorMap(page, mapId)).npcs?.filter((npc) => npc.script === scriptId) ?? [];
  expect(gate).toHaveLength(4);
  expect(gate.every((npc) => (npc.visible !== false) === visible)).toBe(true);
}

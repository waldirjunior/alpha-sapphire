import { createAmxPublicState, runAmx } from './amxRunner';
import { amxError, type AmxBundle, type AmxWorld } from './amxTypes';

export interface AmxSceneChange { scriptId: number; workId: number; value: number }
const sceneChangePublic = 1676684628;

function sceneCell(bundle: AmxBundle, id: string, world: AmxWorld, index: number): number {
  const result = runAmx(bundle, createAmxPublicState(bundle, id, sceneChangePublic, [index], world));
  if (result.status !== 'completed') amxError('AmxSceneChangeError', `${id}: export suspenso no índice ${index}`);
  return result.machines[0].pri;
}

export function readAmxSceneChanges(bundle: AmxBundle, id: string, world: AmxWorld): AmxSceneChange[] {
  const scenes: AmxSceneChange[] = [];
  for (let index = 0; index < 8; index += 1) {
    const scriptId = sceneCell(bundle, id, world, index * 3);
    if (scriptId === -1) break;
    const workId = sceneCell(bundle, id, world, index * 3 + 1) & 0xffff;
    const value = sceneCell(bundle, id, world, index * 3 + 2) & 0xffff;
    scenes.push({ scriptId, workId, value });
  }
  return scenes;
}

export function selectAmxSceneChange(scenes: readonly AmxSceneChange[], vars: Readonly<Record<number, number>>): number | null {
  return scenes.find(row => row.scriptId !== 2000 && ((vars[row.workId] ?? 0) & 0xffff) === row.value)?.scriptId ?? null;
}

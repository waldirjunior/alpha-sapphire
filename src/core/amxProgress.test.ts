import { expect, it } from 'vitest';
import { createAmxWorld } from './amxMemory';
import { amxFlagKey, persistAmxProgress, restoreAmxProgress } from './amxProgress';
import { createInitialState } from './gameState';

it('persists native flags, including reset values, separately from map-scoped deletions', () => {
  const state = createInitialState();
  state.storyFlags.intro_completed = true;
  const world = createAmxWorld(0, 75);
  world.flags[676] = true;
  world.flags[123] = false;
  world.deletedActors['75:12'] = true;
  const saved = persistAmxProgress(state, world);
  const restored = restoreAmxProgress(createAmxWorld(0, 11), saved.storyFlags);
  expect(restored.flags).toEqual({ 676: true, 123: false });
  expect(restored.deletedActors).toEqual({ '75:12': true });
  expect(saved.storyFlags).toMatchObject({ intro_completed: true, [amxFlagKey(676)]: true });
  expect(state.storyFlags).toMatchObject({ intro_completed: true });
  expect(state.storyFlags[amxFlagKey(676)]).toBeUndefined();
  expect(world.zoneId).toBe(75);
  expect(restored.zoneId).toBe(11);
});

it('does not treat unrelated story keys as native flags or mutate the source world', () => {
  const world = createAmxWorld();
  world.flags[676] = true;
  const restored = restoreAmxProgress(world, { [amxFlagKey(676)]: false, 'amx:flag:not-a-number': true, intro_completed: true });
  expect(restored.flags).toEqual({ 676: false });
  expect(world.flags[676]).toBe(true);
});

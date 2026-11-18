import { afterEach, expect, it, vi } from 'vitest';
import { transitionMap } from './mapTransition';

afterEach(() => vi.useRealTimers());

it('commits halfway through a basic fade and restores the original style', async () => {
  vi.useFakeTimers();
  const view = { style: { opacity: '', transition: '' } };
  const commit = vi.fn();
  const fading = transitionMap(view, 3, commit);
  expect(view.style.opacity).toBe('0');
  expect(commit).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(120);
  expect(commit).toHaveBeenCalledTimes(1);
  expect(view.style.opacity).toBe('1');
  await vi.advanceTimersByTimeAsync(120);
  await fading;
  expect(view.style).toEqual({ opacity: '', transition: '' });
});

it('commits immediately without a transition effect', async () => {
  const commit = vi.fn();
  await transitionMap({ style: { opacity: '', transition: '' } }, 0, commit);
  expect(commit).toHaveBeenCalledTimes(1);
});

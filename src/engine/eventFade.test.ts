import { describe, expect, it, vi } from 'vitest';
import type { AmxEffect } from '../core/amxTypes';
import { EventFade } from './eventFade';

const effect = (name: string, args: number[] = []): AmxEffect => ({ channel: 'fade', name, args });

describe('fade de eventos', () => {
  it('projeta fade preto e não confirma término antes dos frames apresentados', () => {
    const project = vi.fn();
    const fade = new EventFade(project);
    expect(fade.request(effect('_FadeRequestIn', [0, 2]))).toBe(0);
    expect(project).toHaveBeenLastCalledWith(0);
    expect(fade.request(effect('FadeIsEnd'))).toBe(0);
    fade.tick();
    expect(project).toHaveBeenLastCalledWith(0.5);
    expect(fade.request(effect('FadeIsEnd'))).toBe(0);
    fade.tick();
    expect(project).toHaveBeenLastCalledWith(1);
    expect(fade.request(effect('FadeIsEnd'))).toBe(1);
    fade.request(effect('FadeRequestOut', [0, 0, 2]));
    fade.tick();
    expect(project).toHaveBeenLastCalledWith(0.5);
    fade.tick();
    expect(project).toHaveBeenLastCalledWith(0);
    expect(fade.request(effect('FadeIsEnd'))).toBe(1);
  });
  it('reset cancela a geração antiga e restaura visibilidade', () => {
    const project = vi.fn();
    const fade = new EventFade(project);
    fade.request(effect('FadeRequestOut', [0, 0, 4]));
    fade.tick();
    fade.reset();
    const calls = project.mock.calls.length;
    fade.tick();
    expect(project).toHaveBeenLastCalledWith(1);
    expect(project).toHaveBeenCalledTimes(calls);
    expect(fade.request(effect('FadeIsEnd'))).toBe(1);
  });
  it('não confirma outras telas, tipos ou durações não suportadas', () => {
    const fade = new EventFade(vi.fn());
    expect(fade.request(effect('FadeRequestOut', [1, 0, 4]))).toBeUndefined();
    expect(fade.request(effect('FadeRequestOut', [0, 1, 4]))).toBeUndefined();
    expect(fade.request(effect('_FadeRequestIn', [0, -1]))).toBeUndefined();
  });
});

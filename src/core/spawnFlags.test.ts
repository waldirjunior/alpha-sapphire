import { describe, expect, it } from 'vitest';
import { createInitialState } from './gameState';
import { isNpcVisible } from './spawnFlags';

describe('spawn flags da campanha inicial', () => {
  it('carrega as flags iniciais observadas e preserva o gatilho de Birch', () => {
    const flags = createInitialState('zone_0006').romEvents?.flags;
    expect(flags).toMatchObject({ 612: true, 603: true, 781: true, 824: true, 825: true });
    expect(flags?.[602]).toBeUndefined();
    expect(flags?.[550]).toBeUndefined();
    expect(flags?.[780]).toBeUndefined();
    expect(Object.keys(flags ?? {})).toHaveLength(331);
  });

  it('esconde somente atores cujo spawnFlag está setado e preserva flag zero', () => {
    const npc = { spawnFlag: 612, visible: undefined };
    expect(isNpcVisible(npc, { 612: true })).toBe(false);
    expect(isNpcVisible(npc, { 612: false })).toBe(true);
    expect(isNpcVisible({ ...npc, spawnFlag: 0 }, { 0: true })).toBe(true);
    expect(isNpcVisible({ ...npc, visible: false }, { 612: false })).toBe(false);
  });
});

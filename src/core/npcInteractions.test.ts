import { describe, expect, it } from 'vitest';
import type { MapNpc } from './types';
import { resolveNpcInteraction } from './npcInteractions';

function npc(overrides: Partial<MapNpc>): MapNpc {
  return {
    id: 'zone_0228:npc:0',
    pos: { x: 10, z: 10 },
    model: 220,
    modelUrl: '/assets/characters/mm_0220.glb',
    script: 1,
    spawnFlag: 0,
    ...overrides,
  };
}

describe('resolveNpcInteraction', () => {
  it('heals the party when talking to Nurse Joy (model 298 or script 2100)', () => {
    const joy = npc({ id: 'zone_0228:npc:6', model: 298, script: 2100 });
    const outcome = resolveNpcInteraction(joy, 'zone_0228', ['Unused line']);
    expect(outcome.healed).toBe(true);
    expect(outcome.text).toContain('Enfermeira Joy');
  });

  it('heals the party when talking to Mom indoors in Littleroot', () => {
    const mom = npc({ id: 'zone_0223:npc:7', model: 280, script: 10584 });
    const outcome = resolveNpcInteraction(mom, 'zone_0223', []);
    expect(outcome.healed).toBe(true);
    expect(outcome.text).toContain('Mãe');
  });

  it('restocks Potions and Poké Balls when talking to a Poké Mart clerk (model 299)', () => {
    const clerk = npc({ id: 'zone_0229:npc:3', model: 299, script: 3 });
    const outcome = resolveNpcInteraction(clerk, 'zone_0229', []);
    expect(outcome.healed).toBe(false);
    expect(outcome.restockItems).toEqual({ potions: 2, pokeballs: 5 });
  });

  it('uses deterministic ROM text lines for other NPCs and falls back cleanly when empty', () => {
    const villager = npc({ id: 'zone_0228:npc:5', model: 219, script: 3 });
    const fromRom = resolveNpcInteraction(villager, 'zone_0228', ['Linha A', 'Linha B', 'Linha C']);
    expect(fromRom.healed).toBe(false);
    expect(fromRom.text).toBe('Linha C');

    const empty = resolveNpcInteraction(villager, 'zone_0228', ['   ', '']);
    expect(empty.text).toBe('Olá! Bem-vindo a Hoenn.');
  });
});

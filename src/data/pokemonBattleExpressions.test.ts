import { describe, expect, it } from 'vitest';
import expressions from './pokemon_battle_expressions.json';

const missingProfiles = ['gothita', 'lillipup', 'pidove', 'shellos', 'swampert'];
const profiles = new Map(Object.entries(expressions.pokemon));

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected expression profile object');
  }
  return Object.fromEntries(Object.entries(value));
}

describe('Pokémon battle expression data', () => {
  it('covers every selected species with a native curve profile', () => {
    expect(Object.keys(expressions.pokemon)).toHaveLength(41);
    for (const slug of missingProfiles) expect(expressions.pokemon).toHaveProperty(slug);
  });

  it('retains texture and visibility curves that use ROM material and mesh names', () => {
    for (const slug of missingProfiles) {
      const profile = profiles.get(slug);
      expect(profile).toBeDefined();
      expect(record(profile).materialBaseTranslations).toBeDefined();
      const actions = record(record(profile).actions);
      expect(Object.values(actions).some(action => Object.keys(record(action).materialTranslations ?? {}).length > 0)).toBe(true);
    }
    const pidove = record(profiles.get('pidove'));
    expect(record(record(pidove.actions).special).meshVisibility).toHaveProperty('pm0519_00_LWingSkin');
  });
});

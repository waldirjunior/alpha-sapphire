import { describe, expect, it } from 'vitest';
import { evaluateGates, gateFailures } from './gates';
import { metricDrift, roundMetrics } from './metricsBaseline';
import type { ProbeMetrics } from './probeReport';
import { VISUAL_SCENARIOS } from './scenarios';

const HEALTHY: ProbeMetrics = { voidRatio: 0.05, avatarVisibility: 0.98, avatarScreenShare: 0.012, groundGap: 0, failedAssets: 0 };
const CLOSEUP = { camera: 'closeup' } as const;
const GAME = { camera: 'game' } as const;

function outcomes(scenario: Parameters<typeof evaluateGates>[0], metrics: ProbeMetrics): Record<string, string> {
  return Object.fromEntries(evaluateGates(scenario, metrics).map((verdict) => [verdict.gate, verdict.outcome]));
}

describe('visual gates', () => {
  it('passes a legible, grounded avatar over terrain', () => {
    expect(outcomes({ ...GAME, knownDefects: {} }, HEALTHY)).toEqual({ assetsLoaded: 'pass', avatarVisible: 'pass', terrainPresent: 'pass' });
    expect(gateFailures(evaluateGates({ ...GAME, knownDefects: {} }, HEALTHY))).toEqual([]);
  });

  it('measures the sole only in close-ups and the void only in the game framing', () => {
    expect(Object.keys(outcomes({ ...CLOSEUP, knownDefects: {} }, HEALTHY))).toEqual(['assetsLoaded', 'avatarVisible', 'feetOnGround']);
  });

  it('flags any asset the loaders could not resolve', () => {
    expect(outcomes({ ...GAME, knownDefects: {} }, { ...HEALTHY, failedAssets: 2 }).assetsLoaded).toBe('regression');
  });

  it('flags an unregistered failure as regression', () => {
    const occluded = { ...HEALTHY, avatarVisibility: 0.2 };
    expect(outcomes({ ...GAME, knownDefects: {} }, occluded).avatarVisible).toBe('regression');
    expect(gateFailures(evaluateGates({ ...GAME, knownDefects: {} }, occluded))).toEqual([expect.stringContaining('avatarVisible: regressão')]);
  });

  it('aceita a oclusão do avatar quando ela coincide com a referência capturada', () => {
    const scenario = { ...GAME, knownDefects: {}, expectedAvatarOcclusion: 'occluded' as const };
    expect(outcomes(scenario, { ...HEALTHY, avatarVisibility: 0.02, avatarScreenShare: 0.01 }).avatarVisible).toBe('pass');
  });

  it('reprova uma oclusão esperada quando o avatar não foi renderizado', () => {
    const scenario = { ...GAME, knownDefects: {}, expectedAvatarOcclusion: 'occluded' as const };
    expect(outcomes(scenario, { ...HEALTHY, avatarVisibility: 0, avatarScreenShare: 0 }).avatarVisible).toBe('regression');
  });

  it('usa a margem de vazio comprovada pela referência do Mauville Hall', () => {
    const scenario = { ...GAME, knownDefects: {}, maxVoidRatio: 0.7 };
    expect(outcomes(scenario, { ...HEALTHY, voidRatio: 0.65 }).terrainPresent).toBe('pass');
    expect(outcomes(scenario, { ...HEALTHY, voidRatio: 0.71 }).terrainPresent).toBe('regression');
  });

  it('keeps the suite green while a registered defect persists', () => {
    const floating = { ...HEALTHY, groundGap: 0.085 };
    const verdicts = evaluateGates({ ...CLOSEUP, knownDefects: { feetOnGround: 'P-019' } }, floating);
    expect(verdicts.find((verdict) => verdict.gate === 'feetOnGround')).toEqual({ gate: 'feetOnGround', outcome: 'known-defect', pendencia: 'P-019' });
    expect(gateFailures(verdicts)).toEqual([]);
  });

  it('demands removing the registration once the defect is fixed', () => {
    const verdicts = evaluateGates({ ...CLOSEUP, knownDefects: { feetOnGround: 'P-019' } }, HEALTHY);
    expect(gateFailures(verdicts)).toEqual([expect.stringMatching(/feetOnGround: corrigido.*P-019/)]);
  });

  it('counts a buried avatar as off the ground too', () => {
    expect(outcomes({ ...CLOSEUP, knownDefects: {} }, { ...HEALTHY, groundGap: -0.4 }).feetOnGround).toBe('regression');
  });

  it('flags a frame dominated by void', () => {
    expect(outcomes({ ...GAME, knownDefects: {} }, { ...HEALTHY, voidRatio: 0.62 }).terrainPresent).toBe('regression');
  });
});

describe('metrics baseline', () => {
  it('accepts drift inside the per-metric tolerance', () => {
    expect(metricDrift(HEALTHY, { ...HEALTHY, voidRatio: 0.065, avatarVisibility: 0.96 })).toEqual([]);
  });

  it('names each metric that moved and by how much', () => {
    const drift = metricDrift(HEALTHY, { ...HEALTHY, voidRatio: 0.4, groundGap: 0.085 });
    expect(drift).toEqual([
      'voidRatio: 0.05 → 0.4 (Δ 0.35, tolerância ±0.02)',
      'groundGap: 0 → 0.085 (Δ 0.085, tolerância ±0.01)',
    ]);
  });

  it('treats a newly missing asset as drift with no tolerance', () => {
    expect(metricDrift(HEALTHY, { ...HEALTHY, failedAssets: 1 })).toEqual(['failedAssets: 0 → 1 (Δ 1, tolerância ±0)']);
  });

  it('rounds to four decimals so the versioned file stays stable', () => {
    expect(roundMetrics({ voidRatio: 0.123456, avatarVisibility: 1, avatarScreenShare: 0.00004, groundGap: -0.00001, failedAssets: 3 }))
      .toEqual({ voidRatio: 0.1235, avatarVisibility: 1, avatarScreenShare: 0, groundGap: 0, failedAssets: 3 });
  });
});

describe('visual scenarios', () => {
  it('uses unique ids safe for file names', () => {
    const ids = VISUAL_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('ties every known defect to a tracked pendência', () => {
    for (const scenario of VISUAL_SCENARIOS) {
      for (const pendencia of Object.values(scenario.knownDefects)) expect(pendencia).toMatch(/^P-\d{3}\b/);
    }
  });

  it('registra a oclusão esperada no telhado e o void original do hall', () => {
    const roof = VISUAL_SCENARIOS.find((scenario) => scenario.id === 'z0006-littleroot-telhado');
    const hall = VISUAL_SCENARIOS.find((scenario) => scenario.id === 'z0445-mauville-hall');
    expect(roof?.expectedAvatarOcclusion).toBe('occluded');
    expect(roof?.knownDefects.avatarVisible).toBeUndefined();
    expect(hall?.knownDefects.avatarVisible).toBeUndefined();
    expect(hall?.maxVoidRatio).toBe(0.7);
  });

  it('covers the Mauville patio entrance and upper floors in Mauville and Route 119', () => {
    const byId = new Map(VISUAL_SCENARIOS.map((scenario) => [scenario.id, scenario]));
    expect(byId.get('z0015-mauville-patio-entry')).toMatchObject({ zone: 15, x: 2, z: 20 });
    expect(byId.get('z0015-mauville-patio-upper-floor')).toMatchObject({ zone: 15, x: 14, z: 9, referenceGroundY: 7.5 });
    expect(byId.get('z0046-route119-bridge-upper-floor')).toMatchObject({ zone: 46, x: 23, z: 40, referenceGroundY: 15.5 });
  });
});

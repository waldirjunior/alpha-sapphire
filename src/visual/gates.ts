import type { ProbeMetrics } from './probeReport';
import type { VisualGate, VisualScenario } from './scenarios';

export const GATE_LIMITS = {
  /** Abaixo disso o avatar não é legível (telhado, parede ou terreno o encobrem). */
  minAvatarVisibility: 0.7,
  /** Acima disso a câmera mostra mais vazio do que cenário. */
  maxVoidRatio: 0.3,
  /** Folga, em tiles, entre a sola do modelo e o chão. */
  maxGroundGap: 0.02,
} as const;

const GATE_CHECKS: Record<VisualGate, (metrics: ProbeMetrics) => boolean> = {
  assetsLoaded: (metrics) => metrics.failedAssets === 0,
  avatarVisible: (metrics) => metrics.avatarVisibility >= GATE_LIMITS.minAvatarVisibility,
  terrainPresent: (metrics) => metrics.voidRatio <= GATE_LIMITS.maxVoidRatio,
  feetOnGround: (metrics) => Math.abs(metrics.groundGap) <= GATE_LIMITS.maxGroundGap,
};

// A sola só é mensurável de perto; o vazio só faz sentido no enquadramento do jogo.
const CAMERA_GATES: Record<VisualScenario['camera'], readonly VisualGate[]> = {
  game: ['assetsLoaded', 'avatarVisible', 'terrainPresent'],
  closeup: ['assetsLoaded', 'avatarVisible', 'feetOnGround'],
};

/**
 * `known-defect` mantém a suíte verde enquanto o defeito registrado persiste;
 * `fixed` falha de propósito para obrigar a remover o registro e fechar a pendência.
 */
export type GateOutcome = 'pass' | 'known-defect' | 'regression' | 'fixed';

export interface GateVerdict {
  gate: VisualGate;
  outcome: GateOutcome;
  pendencia?: string;
}

function outcomeOf(passed: boolean, pendencia: string | undefined): GateOutcome {
  if (passed) return pendencia ? 'fixed' : 'pass';
  return pendencia ? 'known-defect' : 'regression';
}

export function evaluateGates(scenario: Pick<VisualScenario, 'camera' | 'knownDefects'>, metrics: ProbeMetrics): GateVerdict[] {
  return CAMERA_GATES[scenario.camera].map((gate) => {
    const pendencia = scenario.knownDefects[gate];
    return { gate, outcome: outcomeOf(GATE_CHECKS[gate](metrics), pendencia), ...(pendencia ? { pendencia } : {}) };
  });
}

export function gateFailures(verdicts: readonly GateVerdict[]): string[] {
  return verdicts.flatMap((verdict) => {
    if (verdict.outcome === 'regression') return [`${verdict.gate}: regressão — falha sem defeito conhecido registrado`];
    if (verdict.outcome === 'fixed') return [`${verdict.gate}: corrigido — remova o defeito conhecido de scenarios.ts e atualize ${verdict.pendencia}`];
    return [];
  });
}

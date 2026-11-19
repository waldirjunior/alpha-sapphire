import type { ProbeMetrics } from './probeReport';
import type { VisualGate, VisualScenario } from './scenarios';

export const GATE_LIMITS = {
  /** Legibilidade mínima nos pontos em que a referência original deixa o avatar exposto. */
  minAvatarVisibility: 0.7,
  /** Área mínima da silhueta para distinguir a oclusão original de um avatar ausente. */
  minOccludedAvatarScreenShare: 0.001,
  /** Limite para aceitar uma oclusão que a captura original também apresenta. */
  maxExpectedAvatarVisibility: 0.1,
  /** Acima disso a câmera mostra mais vazio do que cenário. */
  maxVoidRatio: 0.3,
  /** Folga, em tiles, entre a sola do modelo e o chão. */
  maxGroundGap: 0.02,
} as const;

type ScenarioGate = Pick<VisualScenario, 'camera' | 'knownDefects' | 'expectedAvatarOcclusion' | 'maxVoidRatio'>;

function avatarMatchesReference(scenario: ScenarioGate, metrics: ProbeMetrics): boolean {
  if (scenario.expectedAvatarOcclusion === 'occluded') {
    return metrics.avatarScreenShare >= GATE_LIMITS.minOccludedAvatarScreenShare &&
      metrics.avatarVisibility <= GATE_LIMITS.maxExpectedAvatarVisibility;
  }
  return metrics.avatarVisibility >= GATE_LIMITS.minAvatarVisibility;
}

const GATE_CHECKS: Record<VisualGate, (scenario: ScenarioGate, metrics: ProbeMetrics) => boolean> = {
  assetsLoaded: (_scenario, metrics) => metrics.failedAssets === 0,
  avatarVisible: avatarMatchesReference,
  terrainPresent: (scenario, metrics) => metrics.voidRatio <= (scenario.maxVoidRatio ?? GATE_LIMITS.maxVoidRatio),
  feetOnGround: (_scenario, metrics) => Math.abs(metrics.groundGap) <= GATE_LIMITS.maxGroundGap,
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

export function evaluateGates(scenario: ScenarioGate, metrics: ProbeMetrics): GateVerdict[] {
  return CAMERA_GATES[scenario.camera].map((gate) => {
    const pendencia = scenario.knownDefects[gate];
    return { gate, outcome: outcomeOf(GATE_CHECKS[gate](scenario, metrics), pendencia), ...(pendencia ? { pendencia } : {}) };
  });
}

export function gateFailures(verdicts: readonly GateVerdict[]): string[] {
  return verdicts.flatMap((verdict) => {
    if (verdict.outcome === 'regression') return [`${verdict.gate}: regressão — falha sem defeito conhecido registrado`];
    if (verdict.outcome === 'fixed') return [`${verdict.gate}: corrigido — remova o defeito conhecido de scenarios.ts e atualize ${verdict.pendencia}`];
    return [];
  });
}

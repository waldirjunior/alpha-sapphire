import type { ProbeMetrics } from './probeReport';

/** Folga absoluta por métrica: absorve antialiasing e diferenças de GPU entre máquinas, não mudanças de cena. */
export const METRIC_TOLERANCE: Record<keyof ProbeMetrics, number> = {
  voidRatio: 0.02,
  avatarVisibility: 0.03,
  avatarScreenShare: 0.005,
  groundGap: 0.01,
  failedAssets: 0,
};

const DECIMALS = 4;

// `+ 0` normaliza -0, que o JSON versionado gravaria como 0 e nunca mais bateria.
function round(value: number): number {
  return Number(value.toFixed(DECIMALS)) + 0;
}

export function roundMetrics(metrics: ProbeMetrics): ProbeMetrics {
  return {
    voidRatio: round(metrics.voidRatio),
    avatarVisibility: round(metrics.avatarVisibility),
    avatarScreenShare: round(metrics.avatarScreenShare),
    groundGap: round(metrics.groundGap),
    failedAssets: metrics.failedAssets,
  };
}

export function metricDrift(baseline: ProbeMetrics, current: ProbeMetrics): string[] {
  return (Object.keys(METRIC_TOLERANCE) as (keyof ProbeMetrics)[]).flatMap((name) => {
    const delta = current[name] - baseline[name];
    if (Math.abs(delta) <= METRIC_TOLERANCE[name]) return [];
    return [`${name}: ${baseline[name]} → ${round(current[name])} (Δ ${round(delta)}, tolerância ±${METRIC_TOLERANCE[name]})`];
  });
}

export type StageStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';

export type StatStages = Readonly<Record<StageStat, number>>;

const MIN_STAGE = -6;
const MAX_STAGE = 6;

// Índices de stat da ROM (Move6.Stat1..3, A-010); 8 = todos os stats de batalha.
const ROM_STAT_IDS: Readonly<Record<number, readonly StageStat[]>> = {
  1: ['atk'],
  2: ['def'],
  3: ['spa'],
  4: ['spd'],
  5: ['spe'],
  6: ['accuracy'],
  7: ['evasion'],
  8: ['atk', 'def', 'spa', 'spd', 'spe'],
};

export const STAT_LABELS: Readonly<Record<StageStat, string>> = {
  atk: 'Ataque',
  def: 'Defesa',
  spa: 'Ataque Especial',
  spd: 'Defesa Especial',
  spe: 'Velocidade',
  accuracy: 'Precisão',
  evasion: 'Evasão',
};

export const NEUTRAL_STAGES: StatStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0 };

export function statsForRomId(romStatId: number): readonly StageStat[] {
  const stats = ROM_STAT_IDS[romStatId];
  if (!stats) {
    throw new Error(`Stat de golpe desconhecido: ${romStatId} (esperado 1..8).`);
  }
  return stats;
}

function clampStage(stage: number): number {
  return Math.max(MIN_STAGE, Math.min(MAX_STAGE, stage));
}

export function applyStageDelta(
  stages: StatStages,
  stat: StageStat,
  delta: number
): { stages: StatStages; applied: number } {
  const next = clampStage(stages[stat] + delta);
  return { stages: { ...stages, [stat]: next }, applied: next - stages[stat] };
}

/** Atk/Def/SpA/SpD/Spe: (2+n)/2 ou 2/(2-n). */
export function statStageMultiplier(stage: number): number {
  const s = clampStage(stage);
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

/** Gen VI: estágio combinado (precisão do atacante − evasão do alvo), (3+n)/3 ou 3/(3-n). */
export function accuracyStageMultiplier(accuracyStage: number, evasionStage: number): number {
  const s = clampStage(accuracyStage - evasionStage);
  return s >= 0 ? (3 + s) / 3 : 3 / (3 - s);
}

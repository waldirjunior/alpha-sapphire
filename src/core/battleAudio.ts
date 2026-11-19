// P-008: faixas de batalha por rótulo do BCSAR (STRM_BGM_VS_*_SG → bgm_sg_vs_*_sg, A-023).
// WIN1..WIN3 por tipo de batalha é inferência pela ordem dos rótulos (A-027), não um campo lido da ROM.

import type { BattleEvent } from './battleEvents';

export type SfxCue = 'dialogue-confirm' | 'menu-open' | 'menu-select' | 'wall-bump' | 'zone-warp' |
  'heal-chime' | 'battle-hit' | 'pokeball-throw' | 'pokeball-capture' | 'faint';
export type BattleSfxEvent = BattleEvent | { type: 'pokeball'; captured: boolean };

export type BattleMusicKind = 'wild' | 'trainer' | 'rival' | 'gym';

export interface BattleMusicSource {
  status: 'ongoing' | 'victory' | 'defeat' | 'fled' | 'caught';
  isTrainer?: boolean;
  trainerName?: string;
}

export const BATTLE_TRACKS: Readonly<Record<BattleMusicKind, string>> = {
  wild: 'bgm_sg_vs_norapoke_sg',
  trainer: 'bgm_sg_vs_trainer_sg',
  rival: 'bgm_sg_vs_rival_sg',
  gym: 'bgm_sg_vs_gymleader_sg',
};

export const VICTORY_TRACKS: Readonly<Record<BattleMusicKind, string>> = {
  wild: 'bgm_sg_win1',
  trainer: 'bgm_sg_win2',
  rival: 'bgm_sg_win2',
  gym: 'bgm_sg_win3',
};

export const JINGLES = {
  heal: 'me_xy_kaifuku',
  levelUp: 'me_xy_lvup',
} as const;

const RIVAL_PATTERN = /\b(rival|may|brendan)\b/i;
const GYM_PATTERN = /\b(leader|gym)\b/i;

export function classifyBattleMusic(battle: Pick<BattleMusicSource, 'isTrainer' | 'trainerName'>): BattleMusicKind {
  if (!battle.isTrainer) return 'wild';
  const name = battle.trainerName ?? '';
  if (GYM_PATTERN.test(name)) return 'gym';
  if (RIVAL_PATTERN.test(name)) return 'rival';
  return 'trainer';
}

/**
 * Faixa enquanto a batalha está aberta: tema durante o combate, fanfarra na vitória.
 * `null` = volta para a BGM da zona (fuga, captura ou derrota).
 */
export function resolveBattleMusic(battle: BattleMusicSource): string | null {
  const kind = classifyBattleMusic(battle);
  if (battle.status === 'ongoing') return BATTLE_TRACKS[kind];
  if (battle.status === 'victory') return VICTORY_TRACKS[kind];
  return null;
}

/** Prioridade: batalha aberta (se tiver faixa) > zona; `null` = silêncio. */
export function resolveCurrentMusic(battle: BattleMusicSource | null, zoneTrack: string | null): string | null {
  return (battle ? resolveBattleMusic(battle) : null) ?? zoneTrack;
}

export function leveledUpDuring(before: readonly { level: number }[], after: readonly { level: number }[]): boolean {
  return after.some((member, idx) => member.level > (before[idx]?.level ?? member.level));
}

export function resolveBattleSfx(event: BattleSfxEvent): SfxCue | null {
  if (event.type === 'pokeball') return event.captured ? 'pokeball-capture' : 'pokeball-throw';
  if (event.type === 'damage') return 'battle-hit';
  if (event.type === 'faint') return 'faint';
  return null;
}

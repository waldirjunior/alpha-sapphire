// P-008: faixas de batalha por nome de stream do BCSAR ORAS (A-023).
// WIN1..WIN3 por tipo de batalha é inferência pela ordem dos rótulos (A-027), não um campo lido da ROM.

import type { BattleEvent } from './battleEvents';

export type SfxCue = 'dialogue-confirm' | 'menu-open' | 'menu-select' | 'wall-bump' | 'zone-warp' |
  'door-close' | 'heal-chime' | 'battle-hit' | 'pokeball-throw' | 'pokeball-capture' | 'faint';
export type BattleSfxEvent = BattleEvent | { type: 'pokeball'; captured: boolean };

export interface BcsarSfxReference {
  index: number;
  label: string;
  url?: string;
}

const BCSAR_SFX = {
  message: { index: 261, label: 'SEQ_SE_MESSAGE' },
  decide: { index: 262, label: 'SEQ_SE_DECIDE1' },
  select: { index: 265, label: 'SEQ_SE_SELECT1' },
  catch: { index: 270, label: 'SEQ_SE_CATCH' },
  recovery: { index: 343, label: 'SEQ_SE_RECOVERY' },
  wallHit: { index: 413, label: 'SEQ_SE_FLD_WALL_HIT' },
  doorClose: { index: 1480, label: 'SEQ_SE_KW_DOORCLOSE' },
  doorOpen: { index: 1481, label: 'SEQ_SE_KW_DOOROPEN' },
} satisfies Readonly<Record<string, BcsarSfxReference>>;

export const BCSAR_SFX_REFERENCES: readonly BcsarSfxReference[] = Object.values(BCSAR_SFX);

const NATIVE_SFX_BY_CUE: Readonly<Partial<Record<SfxCue, BcsarSfxReference>>> = {
  'dialogue-confirm': BCSAR_SFX.message,
  'menu-open': BCSAR_SFX.decide,
  'menu-select': BCSAR_SFX.select,
  'pokeball-capture': BCSAR_SFX.catch,
  'heal-chime': BCSAR_SFX.recovery,
  'wall-bump': BCSAR_SFX.wallHit,
  'zone-warp': BCSAR_SFX.doorOpen,
  'door-close': BCSAR_SFX.doorClose,
};

export function resolveBcsarSfxReference(cue: SfxCue): BcsarSfxReference | undefined {
  return NATIVE_SFX_BY_CUE[cue];
}

// These cue aliases do not decode literal SEPlay IDs into BCSAR indices.
const ZONE_SFX_CUES: Readonly<Record<number, SfxCue>> = {
  0x060000: 'dialogue-confirm',
  0x060061: 'menu-select',
  0x0a00dd: 'zone-warp',
  0x0a0240: 'battle-hit',
};

export type BattleMusicKind = 'wild' | 'trainer' | 'rival' | 'gym_leader' | 'aqua_magma' | 'elite_four' | 'champion' | 'legendary';

export interface BattleMusicSource {
  status: 'ongoing' | 'victory' | 'defeat' | 'fled' | 'caught';
  isTrainer?: boolean;
  trainerName?: string;
  context?: BattleMusicKind;
}

export const BATTLE_TRACKS: Readonly<Record<BattleMusicKind, string>> = {
  wild: 'bgm_sg_vs_norapoke_sg',
  trainer: 'bgm_sg_vs_trainer_sg',
  rival: 'bgm_sg_vs_rival_sg',
  gym_leader: 'bgm_sg_vs_gymleader_sg',
  aqua_magma: 'bgm_sg_vs_aqua_magma',
  elite_four: 'bgm_sg_vs_shitenno_sg',
  champion: 'bgm_sg_vs_champ_sg',
  legendary: 'bgm_sg_vs_legend_sg',
};

export const VICTORY_TRACKS: Readonly<Record<BattleMusicKind, string>> = {
  wild: 'bgm_sg_win1',
  trainer: 'bgm_sg_win2',
  rival: 'bgm_sg_win2',
  gym_leader: 'bgm_sg_win3',
  aqua_magma: 'bgm_sg_win2',
  elite_four: 'bgm_sg_win3',
  champion: 'bgm_sg_win3',
  legendary: 'bgm_sg_win1',
};

export const JINGLES = {
  heal: 'me_xy_kaifuku',
  levelUp: 'me_xy_lvup',
} as const;

const RIVAL_PATTERN = /\b(rival|may|brendan|wally)\b/i;
const AQUA_MAGMA_PATTERN = /\b(team aqua|team magma|aqua grunt|magma grunt|archie|maxie)\b/i;
const ELITE_FOUR_PATTERN = /\b(elite four|sidney|phoebe|glacia|drake)\b/i;
const CHAMPION_PATTERN = /\b(champion|steven(?: stone)?)\b/i;
const LEGENDARY_PATTERN = /\b(legendary|groudon|kyogre|rayquaza|deoxys|latias|latios)\b/i;
const GYM_PATTERN = /\b(gym leader|gym)\b/i;

export function classifyBattleMusic(battle: Pick<BattleMusicSource, 'isTrainer' | 'trainerName' | 'context'>): BattleMusicKind {
  if (battle.context) return battle.context;
  if (!battle.isTrainer) return 'wild';
  const name = battle.trainerName ?? '';
  if (AQUA_MAGMA_PATTERN.test(name)) return 'aqua_magma';
  if (ELITE_FOUR_PATTERN.test(name)) return 'elite_four';
  if (CHAMPION_PATTERN.test(name)) return 'champion';
  if (LEGENDARY_PATTERN.test(name)) return 'legendary';
  if (GYM_PATTERN.test(name)) return 'gym_leader';
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

export function resolveZoneSfx(soundId: number): SfxCue | null {
  return ZONE_SFX_CUES[soundId] ?? null;
}

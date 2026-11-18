import type { DexMoveCategory } from './dex';
import type { BattleSide } from './battleParty';

export type BattleEvent =
  | { type: 'move'; side: BattleSide; category: DexMoveCategory }
  | { type: 'damage' | 'faint'; side: BattleSide };

export function healthEvents(side: BattleSide, before: number, after: number): BattleEvent[] {
  if (after >= before) return [];
  const events: BattleEvent[] = [{ type: 'damage', side }];
  if (after === 0) events.push({ type: 'faint', side });
  return events;
}

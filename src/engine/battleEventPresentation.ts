import type { BattleEvent } from '../core/battleEvents';
import type { BattleSide } from '../core/battleParty';
import type { PokemonType } from '../data/pokemon/species';
import * as THREE from 'three';
import { playBattleAttack, playBattleDamage, type BattleArena } from './battleArena';

export interface BattleAttackIntent {
  readonly type: PokemonType;
  readonly attacker: BattleSide;
}

export interface BattleEventStep {
  readonly event: BattleEvent;
  readonly attack: BattleAttackIntent | null;
}

interface BattleEventHost {
  getVersion(): number;
  isCurrent(version: number): boolean;
  waitForModels(): Promise<void>;
  getArena(): BattleArena;
  getSlot(side: BattleSide): THREE.Group;
  playSfx(event: BattleEvent): void;
  playNativeEvent(slot: THREE.Group, event: BattleEvent): Promise<void>;
}

export function planBattleEventPresentation(
  events: readonly BattleEvent[],
  queuedAttack: BattleAttackIntent | null,
  enemyMoveType: PokemonType
): BattleEventStep[] {
  let pendingAttack = queuedAttack;
  return events.map((event) => {
    if (event.type === 'move' && event.side === 'enemy') {
      pendingAttack = { type: enemyMoveType, attacker: 'enemy' };
    }
    const attack = event.type === 'damage' ? matchingAttack(event, pendingAttack) : null;
    if (attack) pendingAttack = null;
    return { event, attack };
  });
}

export class BattleEventPresenter {
  private pendingAttack: BattleAttackIntent | null = null;

  constructor(private readonly host: BattleEventHost) {}

  public queueAttack(type: PokemonType, attacker: BattleSide): void {
    this.pendingAttack = { type, attacker };
  }

  public clear(): void {
    this.pendingAttack = null;
  }

  public async play(events: readonly BattleEvent[], enemyMoveType: PokemonType): Promise<void> {
    const version = this.host.getVersion();
    const steps = planBattleEventPresentation(events, this.pendingAttack, enemyMoveType);
    this.pendingAttack = null;
    await this.host.waitForModels();
    for (const step of steps) {
      if (!this.host.isCurrent(version)) return;
      await this.playStep(step);
    }
  }

  private async playStep(step: BattleEventStep): Promise<void> {
    const { event, attack } = step;
    this.host.playSfx(event);
    const target = this.host.getSlot(event.side);
    if (attack) this.playAttack(attack);
    if (event.type === 'damage') this.playDamage(target, oppositeSide(event.side));
    await this.host.playNativeEvent(target, event);
  }

  private playAttack(attack: BattleAttackIntent): void {
    const arena = this.host.getArena();
    playBattleAttack(arena, attack.type, attack.attacker, this.host.getSlot('player'), this.host.getSlot('enemy'));
  }

  private playDamage(target: THREE.Group, attacker: BattleSide): void {
    playBattleDamage(this.host.getArena(), target, this.host.getSlot(attacker));
  }
}

function matchingAttack(event: BattleEvent, pendingAttack: BattleAttackIntent | null): BattleAttackIntent | null {
  if (event.type !== 'damage' || !pendingAttack) return null;
  return pendingAttack.attacker === oppositeSide(event.side) ? pendingAttack : null;
}

function oppositeSide(side: BattleSide): BattleSide {
  return side === 'player' ? 'enemy' : 'player';
}

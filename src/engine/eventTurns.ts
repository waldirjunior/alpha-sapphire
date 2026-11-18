import type { Object3D } from 'three';
import type { AmxActor, AmxEffect } from '../core/amxTypes';
import type { MapDefinition } from '../core/types';
import { FACING_YAW } from './zoneEntities';

export interface EventActorContext { actorId: number; actors: Readonly<Record<number, AmxActor>> }
export type EventActorRoot = (map: MapDefinition, actorId: number) => Object3D | undefined;
interface TurnCommand { direction: number; frames: number; repeat: number }
interface TurnQueue {
  actorId: number; root: Object3D; commands: readonly TurnCommand[]; index: number; repeat: number;
  elapsed: number; direction: number; target: number; angle: number; delta: number;
}
const TURN_FRAMES: Readonly<Record<number, number>> = { 5: 12, 6: 8, 7: 4, 250: 8, 251: 12 };
const TURN_YAW = [FACING_YAW.down, FACING_YAW.up, FACING_YAW.left, FACING_YAW.right];

export class EventTurns {
  private build: { actorId: number; commands: TurnCommand[]; blocked: boolean } | null = null;
  private running = new Map<number, TurnQueue>();
  private blocked = new Set<number>();
  private completed: Record<number, number> = {};

  constructor(private readonly rootFor: EventActorRoot) {}

  reset(): void { this.build = null; this.running.clear(); this.blocked.clear(); this.completed = {}; }
  directions(): Readonly<Record<number, number>> { const result = this.completed; this.completed = {}; return result; }

  request(effect: AmxEffect, map: MapDefinition, context: EventActorContext): number | undefined {
    if (effect.name === 'MdlAcmdInit') {
      const raw = (effect.args[0] << 16) >> 16;
      const actorId = raw === -1 ? context.actorId : raw;
      if (!context.actors[actorId]) return undefined;
      this.build = { actorId, commands: [], blocked: false };
      return 0;
    }
    if (effect.name === 'MdlAcmdSet') return this.append(effect.args);
    if (effect.name === 'MdlAcmdSetEnd') return this.begin(map, context);
    if (effect.name !== 'MdlAcmdUpdate') return undefined;
    const actorId = (effect.args[0] << 16) >> 16;
    if (actorId === -1) return this.blocked.size ? undefined : Number(this.running.size === 0);
    if (!context.actors[actorId] || this.blocked.has(actorId)) return undefined;
    return Number(!this.running.has(actorId));
  }

  tick(): void { for (const queue of this.running.values()) this.advance(queue); }

  private append(args: readonly number[]): number | undefined {
    const build = this.build;
    if (!build) return undefined;
    const frames = TURN_FRAMES[args[0] & 0xffff];
    const direction = args[1] & 0xff;
    if (!frames || (direction > 3 && direction !== 9)) { build.blocked = true; return undefined; }
    build.commands.push({ frames, direction, repeat: Math.max(1, args[2] & 0xff) });
    return 0;
  }

  private begin(map: MapDefinition, context: EventActorContext): number | undefined {
    const build = this.build;
    if (!build) return undefined;
    const root = this.rootFor(map, build.actorId);
    const direction = context.actors[build.actorId]?.direction;
    if (build.blocked || !root || direction === undefined || direction < 0 || direction > 3) {
      this.blocked.add(build.actorId);
      return undefined;
    }
    this.blocked.delete(build.actorId);
    if (!build.commands.length) return 0;
    const queue: TurnQueue = { actorId: build.actorId, root, commands: build.commands, index: 0, repeat: 0,
      elapsed: 0, direction, target: direction, angle: root.rotation.y, delta: 0 };
    this.prepare(queue);
    this.running.set(build.actorId, queue);
    this.build = null;
    return 0;
  }

  private prepare(queue: TurnQueue): void {
    const command = queue.commands[queue.index];
    queue.target = command.direction === 9 ? queue.direction : command.direction;
    queue.angle = queue.root.rotation.y;
    const difference = TURN_YAW[queue.target] - queue.angle;
    queue.delta = Math.atan2(Math.sin(difference), Math.cos(difference));
    queue.elapsed = 0;
    if (queue.repeat === 0) queue.repeat = command.repeat;
  }

  private advance(queue: TurnQueue): void {
    const command = queue.commands[queue.index];
    queue.elapsed += 1;
    const fraction = Math.min(1, queue.elapsed / command.frames);
    queue.root.rotation.y = queue.angle + queue.delta * fraction;
    if (fraction < 1) return;
    queue.direction = queue.target;
    this.completed[queue.actorId] = queue.target;
    queue.repeat -= 1;
    if (queue.repeat === 0) queue.index += 1;
    if (queue.index === queue.commands.length) { this.running.delete(queue.actorId); return; }
    this.prepare(queue);
  }
}

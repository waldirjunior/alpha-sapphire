import { createAmxWorld } from '../core/amxMemory';
import { actorDeletionKey, restoreAmxProgress } from '../core/amxProgress';
import { createAmxState, resumeAmx, runAmx } from '../core/amxRunner';
import { readAmxSceneChanges, selectAmxSceneChange } from '../core/amxSceneChanges';
import type { AmxEffect, AmxInput, AmxState, AmxWorld } from '../core/amxTypes';
import type { GameState, MapDefinition, MapNpc } from '../core/types';
import { loadZoneEventPrograms, npcEventProgram, zoneInitProgram, type ZoneEventPrograms } from '../data/zone_scripts/loader';
import { classifyEventRequest, npcActorId, projectEventActors } from './eventHost';
import { EventMessageBanks } from './eventMessages';
import type { EventWarp } from './eventWarp';
import type { EventActorContext } from './eventTurns';

interface TextSource { zone: number; lines: string[] }
const texts = import.meta.glob<TextSource>('../data/texts/zones/*.json', { import: 'default' });
export interface ZoneEventAssets { programs: ZoneEventPrograms | null; lines: readonly string[] }

async function loadZoneEventAssets(zoneId: number): Promise<ZoneEventAssets> {
  const key = String(zoneId).padStart(3, '0');
  const loadText = Object.entries(texts).find(([path]) => path.split('/').at(-1)?.startsWith(`${key}_`))?.[1];
  const [programs, lines] = await Promise.all([loadZoneEventPrograms(zoneId), loadText ? loadText().then(t => t.lines) : Promise.resolve([])]);
  return { programs, lines };
}
interface EventPorts {
  state(): GameState;
  map(): MapDefinition;
  project(map: MapDefinition, world: AmxWorld, player: boolean): void;
  dialogue(text: string | null): void;
  frames(count: number): Promise<void>;
  warp(target: EventWarp, active: () => boolean): Promise<void>;
  report(message: string): void;
  silentAudio(soundId: number): void;
  presentation?: { reset(): void; directions?(): Readonly<Record<number, number>>;
    request(effect: AmxEffect, map: MapDefinition, active: () => boolean, context?: EventActorContext): Promise<number | undefined> };
}

export class ZoneEvents {
  private world = createAmxWorld();
  private loaded: ZoneEventPrograms | null = null;
  private current: AmxState | null = null;
  private messages = new EventMessageBanks([]);
  private waitingKey = false;
  private presentationPaused = false;
  private projectPlayer = false;
  private eventActorId = 0;
  private initializing = false;
  private pausedInit: { state: AmxState; player: boolean; actorId: number; name: string } | null = null;
  private completionValue: number | null = 0;
  private executing = false;
  private pendingEntry = false;
  private scenePending = false;
  private restoredState = false;
  private generation = 0;
  private activeMap = '';
  private readonly initialMaps = new Map<string, MapDefinition>();

  constructor(private readonly ports: EventPorts,
    private readonly loadAssets: (zoneId: number) => Promise<ZoneEventAssets> = loadZoneEventAssets) {}

  get busy(): boolean { return this.executing || (this.current !== null && !this.presentationPaused); }
  get interactionActive(): boolean { return this.current !== null && !this.initializing; }
  get canAdvance(): boolean { return this.waitingKey || (this.presentationPaused && this.completionValue !== null); }
  get pendingEffect(): string | null {
    const pending = this.current?.awaiting;
    return this.presentationPaused && pending?.kind === 'native' ? pending.effect.name : null;
  }

  reset(): void {
    this.generation += 1;
    this.ports.presentation?.reset();
    this.world = createAmxWorld();
    this.current = null;
    this.loaded = null;
    this.initializing = false;
    this.pausedInit = null;
    this.messages = new EventMessageBanks([]);
    this.executing = false;
    this.pendingEntry = false;
    this.scenePending = false;
    this.restoredState = false;
    this.waitingKey = false;
    this.presentationPaused = false;
    this.completionValue = 0;
    this.activeMap = '';
  }

  async enter(reason: 'spawn' | 'boundary' | 'warp' = 'spawn'): Promise<void> {
    const currentMap = this.ports.map();
    const map = this.initialMaps.get(currentMap.id) ?? currentMap;
    if (map.id === this.activeMap || map.zoneId === undefined || !map.npcs) return;
    this.projectPlayer = reason === 'warp';
    this.scenePending = reason !== 'boundary';
    this.initialMaps.set(map.id, map);
    this.activeMap = map.id;
    this.current = null;
    this.loaded = null;
    this.initializing = false;
    this.pausedInit = null;
    this.messages = new EventMessageBanks([]);
    this.waitingKey = false;
    this.presentationPaused = false;
    this.completionValue = 0;
    this.executing = true;
    const generation = ++this.generation;
    this.ports.presentation?.reset();
    try {
      const assets = await this.loadAssets(map.zoneId);
      if (generation !== this.generation) return;
      this.loaded = assets.programs;
      this.messages = new EventMessageBanks(assets.lines);
      const persisted = this.restoredState ? undefined : this.ports.state().romEvents;
      this.world = restoreAmxProgress({ ...this.world, zoneId: map.zoneId, actors: {},
        sex: this.ports.state().player.gender === 'female' ? 1 : 0,
        flags: { ...(persisted?.flags ?? this.world.flags) }, vars: { ...(persisted?.vars ?? this.world.vars) } },
        this.ports.state().storyFlags);
      this.restoredState = true;
      for (const npc of map.npcs) {
        if (this.world.deletedActors[actorDeletionKey(map.zoneId, npcActorId(npc))]) continue;
        this.world.actors[npcActorId(npc)] = {
          x: npc.pos.x + (map.romOrigin?.x ?? 0), y: 0, z: npc.pos.z + (map.romOrigin?.z ?? 0),
          direction: directionCell(npc.facing), visible: npc.visible !== false, moveCode: 0,
        };
      }
      this.refreshPlayer();
      this.ports.project(projectEventActors(map, this.world), this.world, this.projectPlayer);
      const id = this.loaded && zoneInitProgram(this.loaded);
      if (id) { this.initializing = true; await this.start(id, 1); }
      else await this.startNaturalScene();
    } catch (error) {
      if (generation === this.generation) { this.activeMap = ''; this.fail(error); }
    } finally { if (generation === this.generation) this.executing = false; }
  }

  async interact(npc: MapNpc): Promise<boolean> {
    if (this.busy || !this.loaded) return false;
    const id = npcEventProgram(this.loaded, npcActorId(npc), npc.script);
    if (!id) return false;
    if (this.current) {
      const name = this.pendingEffect;
      if (!this.initializing || !name) return false;
      this.pausedInit = { state: this.current, player: this.projectPlayer, actorId: this.eventActorId, name };
      this.current = null;
      this.presentationPaused = false;
    }
    this.initializing = false;
    this.projectPlayer = true;
    this.refreshPlayer();
    await this.start(id, npc.script, npcActorId(npc));
    return true;
  }

  async advance(): Promise<void> {
    if (!this.canAdvance || !this.current || this.executing) return;
    if (this.presentationPaused) this.refreshPlayer();
    this.waitingKey = false;
    this.presentationPaused = false;
    const value = this.completionValue ?? 0;
    this.completionValue = 0;
    await this.drive({ kind: 'native-result', value });
  }

  private refreshPlayer(): void {
    const player = this.ports.state().player;
    const origin = this.ports.map().romOrigin ?? { x: 0, z: 0 };
    this.world.actors[255] = { x: player.pos.x + origin.x, y: 0, z: player.pos.z + origin.z,
      direction: directionCell(player.facing), visible: true, moveCode: 0,
      faceExpression: this.world.actors[255]?.faceExpression ?? player.faceExpression };
  }

  private async start(id: string, scriptId: number, actorId = 0): Promise<void> {
    if (!this.loaded) return;
    this.eventActorId = actorId;
    this.current = createAmxState(this.loaded.bundle, id, scriptId, { ...this.world, effects: [], dialogue: null });
    await this.drive();
  }

  private syncDirections(): void {
    const directions = this.ports.presentation?.directions?.();
    if (!this.current || !directions || !Object.keys(directions).length) return;
    const actors = { ...this.current.world.actors };
    for (const [id, direction] of Object.entries(directions)) {
      const actor = actors[Number(id)];
      if (actor) actors[Number(id)] = { ...actor, direction };
    }
    this.current = { ...this.current, world: { ...this.current.world, actors } };
  }

  private async drive(input?: AmxInput): Promise<void> {
    if (!this.current || !this.loaded) return;
    this.executing = true;
    const generation = this.generation;
    try {
      if (input) this.current = resumeAmx(this.current, input);
      for (let requests = 0; this.current && generation === this.generation; requests += 1) {
        if (requests >= 1000) throw new Error('Evento excede 1000 solicitações do host');
        this.syncDirections();
        this.current = runAmx(this.loaded.bundle, this.current);
        this.world = this.current.world;
        this.ports.project(this.pendingEntry ? this.ports.map() : projectEventActors(this.ports.map(), this.world),
          this.world, !this.pendingEntry && this.projectPlayer);
        if (!this.world.dialogue) this.ports.dialogue(null);
        if (this.current.status === 'completed') { this.current = null; break; }
        const response = await this.serviceRequest(this.current);
        if (!response || generation !== this.generation || !this.current) return;
        this.current = resumeAmx(this.current, response);
      }
    } catch (error) { if (generation === this.generation) this.fail(error); }
    finally { if (generation === this.generation) this.executing = false; }
    if (this.pendingEntry && !this.current && generation === this.generation) {
      this.pendingEntry = false;
      this.activeMap = '';
      await this.enter('warp');
    } else if (generation === this.generation && !this.current) {
      if (this.pausedInit) this.restoreInit();
      else if (this.scenePending) await this.startNaturalScene();
    }
  }

  private async startNaturalScene(): Promise<void> {
    this.scenePending = false;
    if (!this.loaded) return;
    const id = `zone:${String(this.loaded.zoneId).padStart(4, '0')}:map`;
    if (this.loaded.bundle[id]?.publics?.['1676684628'] === undefined) return;
    const scriptId = selectAmxSceneChange(readAmxSceneChanges(this.loaded.bundle, id, this.world), this.world.vars);
    if (scriptId === null) return;
    this.initializing = true;
    this.projectPlayer = true;
    this.ports.report(`Cena AMX natural: zona ${this.loaded.zoneId}, script ${scriptId}`);
    this.refreshPlayer();
    await this.start(id, scriptId);
  }

  private restoreInit(): void {
    const paused = this.pausedInit;
    if (!paused) return;
    this.current = { ...paused.state, world: this.world };
    this.projectPlayer = paused.player;
    this.eventActorId = paused.actorId;
    this.initializing = true;
    this.pausedInit = null;
    this.deferPresentation(this.current, paused.name);
  }

  private async serviceRequest(state: AmxState): Promise<AmxInput | null> {
    const generation = this.generation;
    const effect = state.awaiting?.kind === 'native' ? state.awaiting.effect : undefined;
    const value = effect && await this.messages.request(effect);
    if (generation !== this.generation) return null;
    if (value !== undefined) return { kind: 'native-result', value };
    const presented = effect && await this.ports.presentation?.request(effect, this.ports.map(), () => generation === this.generation,
      { actorId: this.eventActorId, actors: state.world.actors });
    if (generation !== this.generation) return null;
    if (presented !== undefined) return { kind: 'native-result', value: presented };
    const request = classifyEventRequest(state, this.messages.linesFor(effect));
    if (request.kind === 'warp') return this.changeMap(state, request.target);
    if (request.kind === 'opaque') return this.deferPresentation(state, request.name);
    if (request.kind === 'text') {
      this.ports.dialogue(request.text);
      return { kind: 'native-result', value: 0 };
    }
    if (request.kind === 'key') {
      this.waitingKey = true;
      return null;
    }
    if (request.kind === 'frames') {
      await this.ports.frames(request.count);
      return { kind: 'ticks', count: request.count };
    }
    if (request.kind === 'silent-audio') this.ports.silentAudio(request.soundId);
    return { kind: 'native-result', value: request.kind === 'complete' ? request.value : 0 };
  }

  private async changeMap(state: AmxState, target: EventWarp): Promise<AmxInput> {
    const generation = this.generation;
    await this.ports.warp(target, () => generation === this.generation);
    if (generation === this.generation && this.current === state) {
      this.pendingEntry = true;
      this.world = { ...state.world, zoneId: target.zoneId, actors: { ...state.world.actors,
        255: { ...state.world.actors[255], x: target.pos.x, y: target.height, z: target.pos.z,
          direction: directionCell(target.facing) } } };
      this.current = { ...state, world: this.world };
    }
    return { kind: 'native-result', value: 0 };
  }

  private deferPresentation(state: AmxState, name: string): null {
    const pending = state.awaiting;
    const cosmeticActor = ['TalkMdlSetEyeToEye', 'TalkMdlClearEyeToEye', 'TalkMdlSetTalkMotion', 'TalkMdlClearEye', 'BuildMdlEventAnimeSetEnd'].includes(name);
    const approved = pending?.kind === 'native' && (['movement', 'camera'].includes(pending.effect.channel) || cosmeticActor);
    this.completionValue = approved ? (name === 'MdlAcmdUpdate' ? 1 : 0) : null;
    this.presentationPaused = true;
    const args = pending?.kind === 'native' ? `(${pending.effect.args.join(',')})` : '';
    this.ports.report(`Apresentação pendente: ${name}${args}; script suspenso sem bloquear movimento. ${approved
      ? `Enter fornece retorno ${this.completionValue} sem reproduzir o efeito` : 'Retorno sem ABI validada; confirmação indisponível'} (P-013).`);
    return null;
  }

  private fail(error: unknown): void {
    this.current = null;
    this.waitingKey = false;
    this.ports.report(error instanceof Error ? error.message : String(error));
  }
}

function directionCell(direction: MapNpc['facing']): number {
  return { down: 0, up: 1, left: 2, right: 3 }[direction ?? 'down'];
}

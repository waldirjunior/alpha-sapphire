import type { Page } from '@playwright/test';
import type { AmxBundle, AmxInstruction, AmxWorld } from '../../src/core/amxTypes';
import type { GameState, MapDefinition, MapNpc } from '../../src/core/types';
import { SAVE_KEY } from './game';

export interface CorridorFixtureApi {
  applyDerivedRockSmash(): Promise<{ playerUnchanged: boolean; flagsUnchanged: boolean; deleted: string[] }>;
  applyRusturfClear(): Promise<{ flag676: boolean; deleted: string[] }>;
  applyRoute110Clear(): Promise<{ flag660: boolean; work16526: number; deleted: string[] }>;
  applyFlag666(): Promise<{ flag666: boolean; playerUnchanged: boolean }>;
  applyCableCarTransport(): Promise<{ sourceMapId: string; destinationMapId: string; destination: GameState['player']; work16699: number }>;
}

declare global {
  interface Window {
    __corridorFixtures?: CorridorFixtureApi;
  }
}

type ZoneRepository = {
  maps: Record<string, MapDefinition>;
  load(id: string): Promise<MapDefinition>;
};

type MemoryModule = Pick<typeof import('../../src/core/amxMemory'), 'createAmxWorld'>;
type ProgressModule = Pick<typeof import('../../src/core/amxProgress'), 'restoreAmxProgress' | 'persistAmxProgress'>;
type RunnerModule = Pick<typeof import('../../src/core/amxRunner'), 'createAmxState' | 'runAmx'>;
type EventWarpModule = Pick<typeof import('../../src/engine/eventWarp'), 'decodeEventWarp' | 'eventWarpState'>;
type AmxSlice = { start: number; end: number; helper?: { start: number; end: number } };

export async function installCorridorFixtures(page: Page): Promise<void> {
  await page.evaluate(async (saveKey) => {
    type BrowserState = GameState;
    type BrowserMap = MapDefinition;
    type BrowserNpc = MapNpc;
    type BrowserWorld = AmxWorld;
    type BrowserInstruction = AmxInstruction;

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    const moduleUrl = (path: string): string => {
      const entry = performance.getEntriesByType('resource').find((resource) => new URL(resource.name).pathname === path);
      return entry?.name ?? path;
    };
    const isMap = (value: unknown): value is BrowserMap =>
      isRecord(value) && typeof value.id === 'string' && typeof value.width === 'number' &&
      typeof value.height === 'number' && Array.isArray(value.collisions) && Array.isArray(value.warps);
    const isState = (value: unknown): value is BrowserState => {
      if (!isRecord(value) || !isRecord(value.player) || !isRecord(value.player.pos) || !isRecord(value.storyFlags)) return false;
      return typeof value.player.mapId === 'string' && typeof value.player.pos.x === 'number' &&
        typeof value.player.pos.z === 'number' && Object.values(value.storyFlags).every((flag) => typeof flag === 'boolean');
    };
    const requireModule = <T,>(candidate: unknown, required: readonly string[]): T => {
      if (!isRecord(candidate) || required.some((name) => typeof candidate[name] !== 'function')) {
        throw new Error(`Módulo do corredor sem funções ${required.join(', ')}`);
      }
      return candidate as T;
    };
    const requireRecord = (candidate: unknown, name: string): Record<string, unknown> => {
      if (!isRecord(candidate)) throw new Error(`${name} não é um objeto válido`);
      return candidate;
    };
    const readSave = (): { state: BrowserState } & Record<string, unknown> => {
      const raw = localStorage.getItem(saveKey);
      const value: unknown = raw ? JSON.parse(raw) : null;
      if (!isRecord(value) || !isState(value.state)) throw new Error(`Save ${saveKey} inválido para fixture do corredor`);
      return value as { state: BrowserState } & Record<string, unknown>;
    };
    const readInstructions = (source: unknown, programName: string): BrowserInstruction[] => {
      const root = requireRecord(source, 'disassembly');
      const programs = isRecord(root.programs) ? root.programs : undefined;
      const program = programs ? programs[programName] : root;
      if (!isRecord(program) || !Array.isArray(program.instructions)) throw new Error(`Programa ${programName} sem instruções`);
      const instructions: unknown[] = program.instructions;
      if (!instructions.every((row) => isRecord(row) && typeof row.offset === 'number' && typeof row.size === 'number' &&
        typeof row.mnemonic === 'string' && Array.isArray(row.operands) && row.operands.every((operand) => typeof operand === 'number'))) {
        throw new Error(`Programa ${programName} contém instruções inválidas`);
      }
      return instructions as BrowserInstruction[];
    };
    const readDefaultExport = (moduleValue: unknown): unknown => {
      if (!isRecord(moduleValue) || !('default' in moduleValue)) return moduleValue;
      return moduleValue.default;
    };

    const [runtimeValue, memoryValue, progressValue, runnerValue, eventWarpValue] = await Promise.all([
      import(moduleUrl('/src/data/maps_v2/runtime.ts')),
      import(moduleUrl('/src/core/amxMemory.ts')),
      import(moduleUrl('/src/core/amxProgress.ts')),
      import(moduleUrl('/src/core/amxRunner.ts')),
      import(moduleUrl('/src/engine/eventWarp.ts')),
    ]);
    const runtime = requireRecord(runtimeValue, 'runtime');
    if (!isRecord(runtime.zoneMaps) || !isRecord(runtime.zoneMaps.maps) || typeof runtime.zoneMaps.load !== 'function' ||
        !Object.values(runtime.zoneMaps.maps).every(isMap)) throw new Error('Repositório de zonas inválido para fixture');
    const repository = runtime.zoneMaps as unknown as ZoneRepository;
    const memory = requireModule<MemoryModule>(memoryValue, ['createAmxWorld']);
    const progress = requireModule<ProgressModule>(progressValue, ['restoreAmxProgress', 'persistAmxProgress']);
    const runner = requireModule<RunnerModule>(runnerValue, ['createAmxState', 'runAmx']);
    const eventWarp = requireModule<EventWarpModule>(eventWarpValue, ['decodeEventWarp', 'eventWarpState']);

    const fixtureWorld = (state: BrowserState, zoneId: number): BrowserWorld => {
      const initial = memory.createAmxWorld(0, zoneId);
      return progress.restoreAmxProgress({
        ...initial,
        flags: { ...state.romEvents?.flags },
        vars: { ...state.romEvents?.vars },
      }, state.storyFlags);
    };
    const addMapActors = (world: BrowserWorld, map: BrowserMap): void => {
      for (const npc of map.npcs ?? []) addMapActor(world, npc);
    };
    const addMapActor = (world: BrowserWorld, npc: BrowserNpc): void => {
      const actorId = Number(npc.id.split(':').at(-1));
      if (!Number.isInteger(actorId)) throw new Error(`NPC ${npc.id} sem ID numérico`);
      world.actors[actorId] = {
        x: npc.pos.x, y: 0, z: npc.pos.z, direction: 0, visible: npc.visible !== false, moveCode: 0,
      };
    };
    const runSlice = (
      instructions: readonly BrowserInstruction[],
      start: number,
      end: number,
      initial: BrowserWorld,
      helper?: { start: number; end: number }
    ) => {
      const selected = instructions.filter((row) => row.offset >= start && row.offset < end);
      const helperRows = helper ? instructions.filter((row) => row.offset >= helper.start && row.offset < helper.end) : [];
      if (!selected.length) throw new Error(`Nenhuma instrução AMX em ${start}..${end}`);
      const image = {
        data: [0], stackTop: 4096,
        program: { entryPoint: start, dispatch: null, instructions: [
          ...selected, ...helperRows, { offset: end, size: 8, mnemonic: 'halt', operands: [0] },
        ] },
      };
      const bundle: AmxBundle = { fixture: image };
      return runner.runAmx(bundle, runner.createAmxState(bundle, 'fixture', 0, initial));
    };
    const loadProgramInstructions = async (path: string, programName: string): Promise<BrowserInstruction[]> => {
      const source = readDefaultExport(await import(moduleUrl(path)));
      return readInstructions(source, programName);
    };
    const applyAmxSlice = async (
      zoneId: number,
      scriptPath: string,
      programName: string,
      slice: AmxSlice,
      validate: (world: BrowserWorld) => void,
      persistRomState: boolean
    ): Promise<BrowserWorld> => {
      const save = readSave();
      const playerBefore = JSON.stringify(save.state.player);
      const map = await repository.load(`zone_${String(zoneId).padStart(4, '0')}`);
      const world = fixtureWorld(save.state, zoneId);
      addMapActors(world, map);
      const instructions = await loadProgramInstructions(scriptPath, programName);
      const result = runSlice(instructions, slice.start, slice.end, world, slice.helper);
      if (result.status !== 'completed') throw new Error(`AMX ${zoneId}/${programName} não concluiu: ${result.status}`);
      validate(result.world);
      const nextState = progress.persistAmxProgress(save.state, result.world);
      if (JSON.stringify(nextState.player) !== playerBefore) throw new Error(`Fixture AMX ${zoneId} moveu o jogador`);
      save.state = persistRomState
        ? { ...nextState, romEvents: { flags: { ...result.world.flags }, vars: { ...result.world.vars } } }
        : nextState;
      localStorage.setItem(saveKey, JSON.stringify(save));
      return result.world;
    };

    const applyDerivedRockSmash = async (): Promise<CorridorFixtureApi['applyDerivedRockSmash'] extends () => Promise<infer R> ? R : never> => {
      const save = readSave();
      if (save.state.player.mapId !== 'zone_0037') throw new Error('Fixture RockSmash exige Route111/zone_0037');
      const playerBefore = JSON.stringify(save.state.player);
      const world = fixtureWorld(save.state, 37);
      const flagsBefore = JSON.stringify(world.flags);
      for (const actorId of [2, 3, 4, 5]) world.deletedActors[`37:${actorId}`] = true;
      const nextState = progress.persistAmxProgress(save.state, world);
      if (JSON.stringify(nextState.player) !== playerBefore || JSON.stringify(world.flags) !== flagsBefore) {
        throw new Error('Fixture derivada RockSmash alterou jogador ou flags');
      }
      save.state = nextState;
      localStorage.setItem(saveKey, JSON.stringify(save));
      return { playerUnchanged: true, flagsUnchanged: true, deleted: Object.keys(world.deletedActors).filter((id) => world.deletedActors[id]) };
    };
    const applyRusturfClear = async (): Promise<CorridorFixtureApi['applyRusturfClear'] extends () => Promise<infer R> ? R : never> => {
      const world = await applyAmxSlice(75, '/src/data/zone_scripts/0075.json?import', 'map', { start: 6176, end: 6240 }, (result) => {
        if (!result.flags[676] || [12, 13, 14].some((actorId) => result.actors[actorId])) {
          throw new Error('Fatia AMX Rusturf não reproduziu FlagSet676 e MdlDel12/13/14');
        }
      }, false);
      return { flag676: world.flags[676] === true, deleted: Object.keys(world.deletedActors).filter((id) => world.deletedActors[id]) };
    };
    const applyRoute110Clear = async (): Promise<CorridorFixtureApi['applyRoute110Clear'] extends () => Promise<infer R> ? R : never> => {
      const world = await applyAmxSlice(33, '/src/data/zone_scripts/0033.json?import', 'map', { start: 7360, end: 7476 }, (result) => {
        if (!result.flags[660] || result.vars[16526] !== 2 || [9, 10, 11, 12, 13].some((actorId) => result.actors[actorId])) {
          throw new Error('Fatia AMX Route110 não reproduziu flag/work e cinco MdlDel');
        }
      }, true);
      return { flag660: world.flags[660] === true, work16526: world.vars[16526] ?? 0,
        deleted: Object.keys(world.deletedActors).filter((id) => world.deletedActors[id]) };
    };
    const applyFlag666 = async (): Promise<CorridorFixtureApi['applyFlag666'] extends () => Promise<infer R> ? R : never> => {
      const before = JSON.stringify(readSave().state.player);
      const world = await applyAmxSlice(39, '/src/data/zone_scripts/global_0028.json?import', 'root', { start: 21800, end: 21816 }, (result) => {
        if (!result.flags[666]) throw new Error('Fatia global real não setou flag 666');
      }, true);
      const playerUnchanged = JSON.stringify(readSave().state.player) === before;
      if (!playerUnchanged) throw new Error('Fatia global 666 moveu o jogador');
      return { flag666: world.flags[666] === true, playerUnchanged };
    };
    const applyCableCarTransport = async (): Promise<CorridorFixtureApi['applyCableCarTransport'] extends () => Promise<infer R> ? R : never> => {
      const save = readSave();
      if (save.state.player.mapId !== 'zone_0384') throw new Error('Transporte exige a estação inferior/zone_0384');
      const sourceMapId = save.state.player.mapId;
      const source = JSON.stringify(save.state.player);
      const world = fixtureWorld(save.state, 384);
      const instructions = await loadProgramInstructions('/src/data/zone_scripts/0384.json?import', 'map');
      const prepared = runSlice(instructions, 4124, 4144, world);
      if (prepared.status !== 'completed') throw new Error(`Preparação AMX da estação não concluiu: ${prepared.status}`);
      const result = runSlice(instructions, 4220, 4256, prepared.world, { start: 2904, end: 2964 });
      if (result.awaiting?.kind !== 'native' || result.awaiting.effect.name !== '_MapChangeCore') {
        throw new Error('Pós-demo da estação não pediu _MapChangeCore');
      }
      const request = eventWarp.decodeEventWarp(result.awaiting.effect.args);
      if (request.zoneId !== 385 || JSON.stringify(save.state.player) !== source) {
        throw new Error('Fixture de transporte alterou origem ou destino esperado');
      }
      const destination = await repository.load('zone_0385');
      const progressed = progress.persistAmxProgress(save.state, result.world);
      save.state = {
        ...eventWarp.eventWarpState(progressed, destination, request),
        romEvents: { flags: { ...result.world.flags }, vars: { ...result.world.vars } },
      };
      localStorage.setItem(saveKey, JSON.stringify(save));
      return { sourceMapId, destinationMapId: save.state.player.mapId, destination: save.state.player,
        work16699: result.world.vars[16699] ?? 0 };
    };

    window.__corridorFixtures = {
      applyDerivedRockSmash, applyRusturfClear, applyRoute110Clear, applyFlag666, applyCableCarTransport,
    };
  }, SAVE_KEY);
}

export async function applyCorridorFixture<K extends keyof CorridorFixtureApi>(
  page: Page,
  name: K
): Promise<Awaited<ReturnType<CorridorFixtureApi[K]>>> {
  return page.evaluate(async (fixtureName) => {
    const fixture = window.__corridorFixtures?.[fixtureName];
    if (!fixture) throw new Error(`Fixture ${fixtureName} do corredor não instalada`);
    return fixture();
  }, name) as Promise<Awaited<ReturnType<CorridorFixtureApi[K]>>>;
}

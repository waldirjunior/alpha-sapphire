import { describe, expect, it, vi } from 'vitest';
import type { AmxInstruction, AmxWorld } from '../core/amxTypes';
import type { GameState, MapDefinition } from '../core/types';
import type { ZoneEventPrograms } from '../data/zone_scripts/loader';
import { ZoneEvents, type ZoneEventAssets } from './zoneEvents';
import { eventWarpState } from './eventWarp';
import { projectEventPlayer } from './eventHost';

function image(calls: readonly [string, number[]][], wait = false) {
  const instructions: AmxInstruction[] = [{ offset: 0, size: 4, mnemonic: 'proc', operands: [] }];
  let offset = 4;
  for (const [name, args] of calls) {
    for (const value of [...args].reverse()) {
      instructions.push({ offset, size: 4, mnemonic: 'push.p.c', operands: [value] });
      offset += 4;
    }
    instructions.push({ offset, size: 12, mnemonic: 'sysreq.n', operands: [],
      native: { name, hash: 'synthetic' }, argumentBytes: args.length * 4 });
    offset += 12;
    if (name === '_Suspend') {
      instructions.push({ offset, size: 8, mnemonic: 'halt', operands: [12] });
      offset += 8;
    }
  }
  instructions.push({ offset, size: 8, mnemonic: 'halt', operands: [wait ? 12 : 0] });
  return { program: { sha256: 'synthetic', entryPoint: 0, dispatch: { selectorAddress: 0, cases: [{ value: 1, target: 0 }] }, instructions },
    data: [0], stackTop: 1024 };
}

function fixture(calls: readonly [string, number[]][]) {
  const init = image([['FlagSet', [99]], ['MdlSetGPos', [2, 0, 4, 7]]]);
  const talk = image(calls);
  const programs: ZoneEventPrograms = {
    zoneId: 6, bundle: { 'zone:0006:entities': init, 'zone:0006:map': talk },
    zone: { programs: { entities: init.program, map: talk.program }, bindings: [
      { kind: 'npcs', entityId: 7, scriptId: 14, matches: [{ program: 'map' }] },
    ] },
  };
  let map: MapDefinition = { id: 'zone_0006', zoneId: 6, name: 'Synthetic', width: 8, height: 8,
    collisions: [], warps: [], npcs: [{ id: 'zone_0006:npc:7', pos: { x: 1, z: 1 }, modelUrl: '', model: 1, script: 14, spawnFlag: 0 }] };
  const state: GameState = { player: { id: 'p', mapId: map.id, pos: { x: 2, z: 5 }, facing: 'up' }, storyFlags: {} };
  const dialogue = vi.fn<(text: string | null) => void>();
  const frames = vi.fn(async (_count: number) => {});
  const report = vi.fn();
  const worlds: AmxWorld[] = [];
  const ports = { state: () => state, map: () => map, dialogue, frames, report, silentAudio: vi.fn(), warp: vi.fn(async () => {}),
    project: (next: MapDefinition, world: AmxWorld) => { map = next; worlds.push(world); } };
  const assets: ZoneEventAssets = { programs, lines: ['Synthetic message'] };
  return { ports, programs, assets, worlds, npc: () => map.npcs![0] };
}

describe('ciclo de vida do host de zonas', () => {
  it('transporta ChangeFace sem confirmação cosmética e preserva expressão ao atualizar player', async () => {
    const f = fixture([['ChangeFace', [7, 1]], ['ChangeFace', [255, 3]], ['LastKeyWait', []], ['ChangeFace', [7, 0]]]);
    const events = new ZoneEvents(f.ports, async () => f.assets);
    await events.enter();
    await events.interact(f.npc());
    expect(f.npc().faceExpression).toBe(1);
    expect(f.worlds.at(-1)?.actors[255].faceExpression).toBe(3);
    expect(events.pendingEffect).toBeNull();
    expect(events.canAdvance).toBe(true);
    await events.advance();
    expect(f.npc().faceExpression).toBe(0);
    expect(f.worlds.at(-1)?.actors[255].faceExpression).toBe(3);
    expect(f.ports.report).not.toHaveBeenCalled();
  });

  it('preserva chegada contínua 7→24 e libera input enquanto init permanece opaco', async () => {
    const f = fixture([]);
    f.programs.bundle = { ...f.programs.bundle, 'zone:0006:entities': image([
      ['MdlSetGPos', [78, 0, 22, 255]], ['MdlSetDirDisp', [255, 2]],
      ['MdlSetGPos', [2, 0, 4, 7]], ['BuildMdlEventAnimeSetEnd', [1, 0]],
    ]) };
    let map = { ...f.ports.map(), id: 'zone_0007', zoneId: 7 };
    let state = { ...f.ports.state(), player: { ...f.ports.state().player, mapId: map.id } };
    const events = new ZoneEvents({ ...f.ports, state: () => state, map: () => map,
      project: (next, world, player) => { state = projectEventPlayer(state, next, world, player); },
    }, async () => f.assets);
    await events.enter();
    expect(state.player.pos).toEqual({ x: 2, z: 5 });
    map = { ...map, id: 'zone_0024', zoneId: 24 };
    state = { ...state, player: { ...state.player, mapId: map.id, pos: { x: 79, z: 20 }, facing: 'right' } };
    await events.enter('boundary');
    expect(state.player).toMatchObject({ mapId: 'zone_0024', pos: { x: 79, z: 20 }, facing: 'right' });
    expect(events.busy).toBe(false);
    expect(events.pendingEffect).toBe('BuildMdlEventAnimeSetEnd');
    expect(f.ports.dialogue.mock.calls.every(([text]) => text === null)).toBe(true);
  });

  it('permite NPC com init opaco suspenso e restaura init sem perder flags da interação', async () => {
    const f = fixture([['FlagSet', [123]], ['TalkMdlMsg_Seq', [0, ...Array<number>(18).fill(0)]], ['MsgWinAllClose', []]]);
    f.programs.bundle = { ...f.programs.bundle, 'zone:0006:entities': image([['BuildMdlEventAnimeSetEnd', [1, 0]], ['FlagSet', [88]]]) };
    const events = new ZoneEvents(f.ports, async () => f.assets);
    await events.enter();
    expect(events.busy).toBe(false);
    expect(await events.interact(f.npc())).toBe(true);
    expect(f.ports.dialogue).toHaveBeenLastCalledWith('Synthetic message');
    await events.advance();
    expect(events.pendingEffect).toBe('BuildMdlEventAnimeSetEnd');
    expect(events.busy).toBe(false);
    await events.advance();
    expect(f.worlds.at(-1)?.flags).toMatchObject({ 88: true, 123: true });
    expect(events.pendingEffect).toBeNull();
  });

  it('executa init uma vez por entrada e mantém flags/posições entre invocações', async () => {
    const f = fixture([]);
    const load = vi.fn(async () => f.assets);
    const events = new ZoneEvents(f.ports, load);
    await events.enter();
    await events.enter();
    expect(load).toHaveBeenCalledTimes(1);
    expect(f.npc().pos).toEqual({ x: 2, z: 4 });
    expect(f.worlds.at(-1)?.flags[99]).toBe(true);
    expect(await events.interact(f.npc())).toBe(true);
    expect(f.worlds.at(-1)?.flags[99]).toBe(true);
    expect(events.busy).toBe(false);
  });

  it('consome frames determinísticos e não avança textbox antes de entrada do jogador', async () => {
    const f = fixture([['_Suspend', [3]], ['TalkMdlMsg_Seq', [0, ...Array<number>(18).fill(0)]], ['LastKeyWait', []], ['MsgWinAllClose', []]]);
    const events = new ZoneEvents(f.ports, async () => f.assets);
    await events.enter();
    await events.interact(f.npc());
    expect(f.ports.frames).toHaveBeenCalledWith(3);
    expect(f.ports.dialogue).toHaveBeenLastCalledWith('Synthetic message');
    expect(events.busy).toBe(true);
    expect(await events.interact(f.npc())).toBe(false);
    await events.advance();
    expect(events.busy).toBe(true);
    await events.advance();
    expect(events.busy).toBe(false);
    expect(f.ports.dialogue).toHaveBeenLastCalledWith(null);
    expect(f.ports.report).not.toHaveBeenCalled();
  });

  it('não confirma ACMD automaticamente; mantém o efeito opaco até Enter explícito', async () => {
    const f = fixture([['MdlAcmdInit', [7]], ['MdlAcmdUpdate', [7]]]);
    const events = new ZoneEvents(f.ports, async () => f.assets);
    await events.enter();
    await events.interact(f.npc());
    expect(events.busy).toBe(false);
    expect(events.pendingEffect).toBe('MdlAcmdInit');
    expect(f.ports.report).toHaveBeenLastCalledWith(expect.stringContaining('MdlAcmdInit'));
    await events.advance();
    expect(events.busy).toBe(false);
    expect(f.ports.report).toHaveBeenLastCalledWith(expect.stringContaining('retorno 1'));
    await events.advance();
    expect(events.busy).toBe(false);
    expect(f.worlds.at(-1)?.effects.map(effect => effect.name)).toEqual(['MdlAcmdInit', 'MdlAcmdUpdate']);
  });

  it('conclui VM após warp sem projetar atores antigos e inicializa destino com flags preservadas', async () => {
    const f = fixture([['_MapChangeCore', [7, 4, 0, 6, 1, 0, 0, 0, 0]], ['FlagSet', [123]]]);
    let map = f.ports.map();
    let state = f.ports.state();
    const load = vi.fn(async (zoneId: number) => zoneId === 6 ? f.assets : { programs: null, lines: [] });
    const events = new ZoneEvents({ ...f.ports, state: () => state, map: () => map,
      project: (next, world) => { map = next; f.ports.project(next, world); },
      warp: async (target, active) => {
        expect(active()).toBe(true);
        map = { ...map, id: 'zone_0007', zoneId: 7, npcs: [] };
        state = eventWarpState(state, map, target);
      },
    }, load);
    await events.enter();
    await events.interact(f.npc());
    expect(events.busy).toBe(false);
    expect(state.player).toMatchObject({ mapId: 'zone_0007', pos: { x: 4, z: 6 }, facing: 'up' });
    expect(load).toHaveBeenNthCalledWith(2, 7);
    expect(f.worlds.at(-1)?.flags[123]).toBe(true);
    expect(f.worlds.at(-1)?.actors[7]).toBeUndefined();
    expect(f.ports.report).not.toHaveBeenCalled();
  });

  it('mantém animação de construção opaca até confirmação explícita', async () => {
    const f = fixture([['BuildMdlEventAnimeSetEnd', [6815923, 0]]]);
    const events = new ZoneEvents(f.ports, async () => f.assets);
    await events.enter();
    await events.interact(f.npc());
    expect(events.busy).toBe(false);
    expect(events.pendingEffect).toBe('BuildMdlEventAnimeSetEnd');
    expect(f.ports.report).toHaveBeenLastCalledWith(expect.stringContaining('BuildMdlEventAnimeSetEnd'));
    expect(f.ports.dialogue.mock.calls.every(([text]) => text === null)).toBe(true);
    await events.advance();
    expect(events.busy).toBe(false);
    expect(events.pendingEffect).toBeNull();
  });

  it('suspende consulta sem ABI de retorno sem textbox, bloqueio de movimento ou conclusão inventada', async () => {
    const f = fixture([['SEIsPlaying', [1]], ['FlagSet', [123]]]);
    const events = new ZoneEvents(f.ports, async () => f.assets);
    await events.enter();
    await events.interact(f.npc());
    expect(events.pendingEffect).toBe('SEIsPlaying');
    expect(events.busy).toBe(false);
    expect(events.canAdvance).toBe(false);
    await events.advance();
    expect(events.pendingEffect).toBe('SEIsPlaying');
    expect(f.worlds.at(-1)?.flags[123]).toBeUndefined();
    expect(f.ports.dialogue.mock.calls.every(([text]) => text === null)).toBe(true);
  });

  it('usa fallback somente para vínculos ausentes/ambíguos e não inventa imagens', async () => {
    const f = fixture([]);
    f.programs.zone.bindings[0].matches.push({ program: 'entities' });
    const events = new ZoneEvents(f.ports, async () => f.assets);
    await events.enter();
    expect(await events.interact(f.npc())).toBe(false);
    expect(await events.interact({ ...f.npc(), script: 100 })).toBe(false);
    expect(f.ports.report).not.toHaveBeenCalled();
  });

  it('ignora carregamento tardio após reset e permite tentar novamente', async () => {
    const f = fixture([]);
    let finish: (assets: ZoneEventAssets) => void = () => { throw new Error('load não iniciado'); };
    const load = vi.fn(() => new Promise<ZoneEventAssets>(resolve => { finish = resolve; }));
    const events = new ZoneEvents(f.ports, load);
    const entering = events.enter();
    events.reset();
    finish(f.assets);
    await entering;
    expect(f.worlds).toEqual([]);
    expect(events.busy).toBe(false);
    const retry = events.enter();
    finish(f.assets);
    await retry;
    expect(load).toHaveBeenCalledTimes(2);
    expect(f.worlds.at(-1)?.flags[99]).toBe(true);
  });

  it('interrompe nativa desconhecida sem responder sucesso e libera input', async () => {
    const f = fixture([['NativaNaoMapeada', []]]);
    const events = new ZoneEvents(f.ports, async () => f.assets);
    await events.enter();
    await events.interact(f.npc());
    expect(events.busy).toBe(false);
    expect(f.ports.report).toHaveBeenCalledWith(expect.stringContaining('NativaNaoMapeada'));
  });
});

import { describe, expect, it } from 'vitest';
import { createScriptState, runScript, resumeScript, UnsupportedScriptNativeError } from './scriptRunner';
import type { ScriptCommand } from './scriptTypes';

const context = { texts: { 1: 'Bem-vindo a Littleroot!' }, warps: { '223:0': { x: 4, y: 0, z: 5 } } };
const initial = () => createScriptState(6, { 255: { x: 0, y: 0, z: 0, visible: true, direction: 0 }, 1: { x: 1, y: 0, z: 1, visible: true, direction: 0 } });

describe('scriptRunner', () => {
  it('move NPC e player, mostra texto, espera e faz warp sem mutar a entrada', () => {
    const program: ScriptCommand[] = [
      { kind: 'native', name: 'MdlSetGPos', args: [1, 2, 0, 3] },
      { kind: 'native', name: 'MdlSetGPos', args: [255, 3, 0, 4] },
      { kind: 'native', name: 'TalkMdlMsg_Seq', args: [1] },
      { kind: 'native', name: '_ABKeyWait', args: [] },
      { kind: 'native', name: 'MsgWinAllClose', args: [] },
      { kind: 'native', name: 'WarpSetID', args: [223, 0] },
      { kind: 'stop' },
    ];
    const start = initial();
    const paused = runScript(program, start, context);
    expect(paused.status).toBe('waiting-input');
    expect(paused.dialogue).toBe('Bem-vindo a Littleroot!');
    expect(paused.actors[1].x).toBe(2);
    expect(start.actors[1].x).toBe(1);
    const end = runScript(program, resumeScript(paused), context);
    expect(end.status).toBe('completed');
    expect(end.zoneId).toBe(223);
    expect(end.actors[255]).toMatchObject({ x: 4, z: 5 });
    expect(end.dialogue).toBeNull();
  });

  it('rejeita nativa desconhecida pelo nome sem avançar estado', () => {
    const state = initial();
    expect(() => runScript([{ kind: 'native', name: 'UnknownNative', args: [] }], state, context)).toThrow(UnsupportedScriptNativeError);
    expect(state.pc).toBe(0);
  });

  it('detecta loop por orçamento determinístico', () => {
    expect(() => runScript([{ kind: 'jump', target: 0 }], initial(), context, 5)).toThrow(/ScriptExecutionLimitError/);
  });

  it('rejeita argumentos, ator, texto e destino inexistentes', () => {
    for (const call of [
      { name: 'MdlSetGPos', args: [1] }, { name: 'MdlSetGPos', args: [999, 0, 0, 0] },
      { name: 'TalkMdlMsg_Seq', args: [999] }, { name: 'WarpSetID', args: [999, 0] },
    ]) expect(() => runScript([{ kind: 'native', ...call }], initial(), context)).toThrow();
  });

  it('executa visibilidade, direção e NOP sem mutar atores', () => {
    const start = initial();
    const end = runScript([
      { kind: 'native', name: 'CommandNOP', args: [] },
      { kind: 'native', name: 'MdlSetVisible', args: [1, 0] },
      { kind: 'native', name: 'MdlSetDirDisp', args: [1, 3] },
      { kind: 'stop' },
    ], start, context);
    expect(end.actors[1]).toMatchObject({ visible: false, direction: 3 });
    expect(start.actors[1]).toMatchObject({ visible: true, direction: 0 });
    expect(resumeScript(end)).toBe(end);
  });

  it('rejeita salto inválido e nomes herdados do prototype', () => {
    expect(() => runScript([{ kind: 'jump', target: -1 }], initial(), context)).toThrow(/jump -1/);
    expect(() => runScript([{ kind: 'native', name: 'constructor', args: [] }], initial(), context)).toThrow(UnsupportedScriptNativeError);
  });

  it('espera ticks explícitos e mantém reexecução determinística', () => {
    const program: ScriptCommand[] = [{ kind: 'native', name: '_Suspend', args: [2] }, { kind: 'stop' }];
    const first = runScript(program, initial(), context);
    expect(runScript(program, initial(), context)).toEqual(first);
    expect(resumeScript(first, 1).status).toBe('waiting-ticks');
    expect(runScript(program, resumeScript(first, 2), context).status).toBe('completed');
  });
});

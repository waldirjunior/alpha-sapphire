import { describe, expect, it } from 'vitest';
import { createAmxState, resumeAmx, runAmx } from './amxRunner';
import { createAmxWorld } from './amxMemory';
import type { AmxBundle, AmxInstruction, AmxWorld } from './amxTypes';

function syntheticBundle(calls: readonly { name: string; args: number[] }[], suffix: AmxInstruction[] = []): AmxBundle {
  const instructions: AmxInstruction[] = [{ offset: 0, size: 4, mnemonic: 'proc', operands: [] }];
  let offset = 4;
  for (const call of calls) {
    for (const arg of [...call.args].reverse()) {
      instructions.push({ offset, size: 8, mnemonic: 'push.c', operands: [arg] }); offset += 8;
    }
    instructions.push({ offset, size: 12, mnemonic: 'sysreq.n', operands: [0, call.args.length * 4],
      argumentBytes: call.args.length * 4, native: { name: call.name, hash: 'synthetic' } }); offset += 12;
  }
  for (const row of suffix) { instructions.push({ ...row, offset }); offset += row.size; }
  instructions.push({ offset, size: 4, mnemonic: 'retn', operands: [] });
  return { synthetic: { program: { entryPoint: 0, dispatch: null, instructions }, data: [0], stackTop: 4096 } };
}
const execute = (bundle: AmxBundle, world: AmxWorld) => runAmx(bundle, createAmxState(bundle, 'synthetic', 0, world));

describe('nativas de estado Pawn', () => {
  it('persiste flags/vars, entrega item/Pokémon por handle, cura e registra warp sem mutar a origem', () => {
    const world = createAmxWorld();
    world.pokemon[100] = { handle: 100, species: 258, hp: 1, maxHp: 20, isEgg: false, nickname: 'Mudkip', status: 3 };
    const bundle = syntheticBundle([
      { name: 'FlagSet', args: [16] }, { name: 'WorkSet', args: [16497, 6] },
      { name: 'ItemAdd', args: [4, 2] }, { name: 'PokePartyAdd', args: [100, 0] },
      { name: 'PokePartyRecoverAll', args: [] }, { name: 'WarpSetID', args: [5] },
      { name: 'FlagReset', args: [16] }, { name: 'FlagGet', args: [16] },
    ]);
    const result = execute(bundle, world);
    expect(result.status).toBe('completed');
    expect(result.world).toMatchObject({ flags: { 16: false }, vars: { 16497: 6 }, bag: { 4: 2 }, warpId: 5 });
    expect(result.world.party[0]).toMatchObject({ hp: 20, status: 0, species: 258 });
    expect(world.party).toEqual([]);
    expect(world.pokemon[100].hp).toBe(1);
    expect(result.machines[0].pri).toBe(0);
  });

  it('checa capacidade sem adicionar e recusa overflow', () => {
    const world = createAmxWorld(); world.bag[4] = 999;
    const result = execute(syntheticBundle([{ name: 'ItemAddCheck', args: [4, 1] }]), world);
    expect(result.world.bag[4]).toBe(999);
    expect(result.machines[0].pri).toBe(0);
  });

  it.each([0, 1])('preserva resposta %s de YesNoWin_Seq e escreve o retorno no estado Pawn', value => {
    const bundle = syntheticBundle([{ name: 'YesNoWin_Seq', args: [0, 0, 0, 0] }],
      [{ offset: 0, size: 8, mnemonic: 'stor.pri', operands: [0] }]);
    const paused = execute(bundle, createAmxWorld());
    expect(paused.awaiting).toMatchObject({ kind: 'native', effect: { name: 'YesNoWin_Seq', channel: 'choice' } });
    const result = runAmx(bundle, resumeAmx(paused, { kind: 'native-result', value }));
    expect(result.status).toBe('completed'); expect(result.machines[0].memory[0]).toBe(value);
    expect(paused.status).toBe('await-input');
    expect(() => resumeAmx(paused, { kind: 'ticks', count: 1 })).toThrow('AmxInputError');
    expect(() => resumeAmx(paused, { kind: 'native-result', value, writes: [{ address: 0, value: NaN }] })).toThrow('AmxInputError');
  });

  it('executa _Suspend/HALT 12 e consome somente ticks externos', () => {
    const bundle = syntheticBundle([{ name: '_Suspend', args: [3] }],
      [{ offset: 0, size: 8, mnemonic: 'halt', operands: [12] }]);
    const paused = execute(bundle, createAmxWorld());
    expect(paused.awaiting).toEqual({ kind: 'ticks', remaining: 3 });
    const partial = resumeAmx(paused, { kind: 'ticks', count: 2 });
    expect(partial.awaiting).toEqual({ kind: 'ticks', remaining: 1 });
    expect(runAmx(bundle, resumeAmx(partial, { kind: 'ticks', count: 1 })).status).toBe('completed');
    expect(paused.awaiting).toEqual({ kind: 'ticks', remaining: 3 });
  });

  it.each(['UnknownNative', 'constructor'])('rejeita %s com erro nomeado e valida assinatura', name => {
    expect(() => execute(syntheticBundle([{ name, args: [] }]), createAmxWorld()))
      .toThrowError(expect.objectContaining({ name: 'UnsupportedScriptNativeError' }));
    expect(() => execute(syntheticBundle([{ name: 'FlagSet', args: [] }]), createAmxWorld())).toThrow('AmxNativeSignatureError');
  });

  it.each(['read', 'write'])('preserva parâmetros e retorno entre VMs globais: %s', operation => {
    const calls = [{ name: 'GlobalSetChildParam', args: [0, 7] }, { name: 'GlobalCall', args: [2000] }];
    if (operation === 'write') calls.push({ name: 'GlobalGetChildParam', args: [0] });
    const parent = syntheticBundle(calls, [{ offset: 0, size: 8, mnemonic: 'stor.pri', operands: [0] }]).synthetic;
    const child = syntheticBundle([{ name: operation === 'read' ? 'GlobalGetParentParam' : 'GlobalSetParentParam',
      args: operation === 'read' ? [0] : [0, 9] }]).synthetic;
    const bundle: AmxBundle = { synthetic: parent, 'global:child': { ...child, program: { ...child.program,
      dispatch: { selectorAddress: 0, cases: [{ value: 2000, target: 0 }] } } } };
    const result = execute(bundle, createAmxWorld());
    expect(result.status).toBe('completed'); expect(result.machines).toHaveLength(1);
    expect(result.machines[0].memory[0]).toBe(operation === 'read' ? 7 : 9);
  });

  it('interrompe um salto infinito por orçamento', () => {
    const bundle: AmxBundle = { loop: { program: { entryPoint: 0, dispatch: null,
      instructions: [{ offset: 0, size: 8, mnemonic: 'jump', operands: [0], target: 0 }] }, data: [0], stackTop: 4096 } };
    expect(() => runAmx(bundle, createAmxState(bundle, 'loop', 0, createAmxWorld()), 10)).toThrow('AmxExecutionLimitError');
  });
});

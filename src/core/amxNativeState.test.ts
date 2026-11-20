import { describe, expect, it } from 'vitest';
import { createAmxState, resumeAmx, runAmx } from './amxRunner';
import { cellFromFloat, createAmxWorld, floatFromCell } from './amxMemory';
import type { AmxBundle, AmxInstruction, AmxWorld } from './amxTypes';
import rusturf from '../data/zone_scripts/0075.json';

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
  it.each([0, 1, 2, 3, 4, 5, 6, 7])('ChangeFace aplica expressão %s somente ao ator resolvido', expression => {
    const world = createAmxWorld();
    world.actors[7] = { x: 1, y: 0, z: 2, direction: 0, visible: true, moveCode: 0 };
    world.actors[8] = { ...world.actors[7] };
    const result = execute(syntheticBundle([{ name: 'ChangeFace', args: [7, expression] }]), world);
    expect(result.status).toBe('completed');
    expect(result.world.actors[7]).toHaveProperty('faceExpression', expression);
    expect(result.world.actors[8]).not.toHaveProperty('faceExpression');
    expect(world.actors[7]).not.toHaveProperty('faceExpression');
    expect(result.world.effects).toEqual([]);
    expect(result.machines[0].pri).toBe(0);
  });

  it.each([[65543, 257, 1], [7, 8, 0], [7, 255, 0], [7, 256, 0]])(
    'ChangeFace replica casts uint16/uint8 e fallback zero (%s,%s)', (id, expression, expected) => {
      const world = createAmxWorld();
      world.actors[7] = { x: 1, y: 0, z: 2, direction: 0, visible: true, moveCode: 0 };
      const result = execute(syntheticBundle([{ name: 'ChangeFace', args: [id, expression] }]), world);
      expect(result.status).toBe('completed');
      expect(result.world.actors[7]).toHaveProperty('faceExpression', expected);
    });

  it('ChangeFace para ator não encontrado é no-op, sem tratar argumento como speaker', () => {
    const world = createAmxWorld();
    const result = execute(syntheticBundle([{ name: 'ChangeFace', args: [1234, 1] }]), world);
    expect(result.status).toBe('completed');
    expect(result.world.actors).toEqual({});
  });
  it.each([[0, 0], [-5, -5], [16777217, 16777216], [2147483647, 2147483648]])('converte inteiro signed %s em float32 %s pela ABI VCVT', (value, expected) => {
    const result = execute(syntheticBundle([{ name: 'float', args: [value] }]), createAmxWorld());
    expect(result.status).toBe('completed');
    expect(floatFromCell(result.machines[0].pri)).toBe(expected);
    expect(result.world.effects).toEqual([]);
  });
  it.each([[1.5, 2.25, 3.75], [16777216, 1, 16777216], [-4, 1.5, -2.5]])('soma células float32 %s + %s = %s pela ABI VADD', (left, right, expected) => {
    const result = execute(syntheticBundle([{ name: 'floatadd', args: [cellFromFloat(left), cellFromFloat(right)] }]), createAmxWorld());
    expect(result.status).toBe('completed');
    expect(floatFromCell(result.machines[0].pri)).toBe(expected);
    expect(result.world.effects).toEqual([]);
  });
  it.each([[104, 179, 6815923], [-1, 2, -65534], [65536, -1, -1]])('empacota construção (%s,%s) sem consultar ator', (x, z, handle) => {
    const world = createAmxWorld();
    const result = execute(syntheticBundle([{ name: 'BuildMdlGetHandleByGPos', args: [x, z] }]), world);
    expect(result.status).toBe('completed');
    expect(result.machines[0].pri).toBe(handle);
    expect(result.world.actors).toEqual({});
    expect(result.world.effects).toEqual([]);
  });
  it.each([
    ['MdlGetGPosX', 104],
    ['MdlGetGPosZ', 179],
  ] as const)('%s retorna coordenada inteira de grade, não bits float32', (name, coordinate) => {
    const world = createAmxWorld();
    world.actors[7] = { x: 104, y: 0, z: 179, direction: 0, visible: true, moveCode: 0 };
    const result = execute(syntheticBundle([{ name, args: [7] }]), world);
    expect(result.status).toBe('completed');
    expect(result.machines[0].pri).toBe(coordinate);
    expect(result.world.actors[7]).toEqual(world.actors[7]);
  });
  it('normaliza índice e valor de work para unsigned-16 como os wrappers CRO', () => {
    const world = createAmxWorld();
    const result = execute(syntheticBundle([{ name: 'WorkSet', args: [0x14000, -1] },
      { name: 'WorkGet', args: [0x14000] }]), world);
    expect(result.machines[0].pri).toBe(65535);
    expect(result.world.vars).toEqual({ 16384: 65535 });
    expect(world.vars).toEqual({});
  });
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

  it('adds a Pokémon selected by an event with ROM mode 1 and copies it immutably', () => {
    const world = createAmxWorld();
    world.pokemon[258] = { handle: 258, species: 258, hp: 20, maxHp: 20,
      isEgg: false, nickname: 'Mudkip', status: 0 };
    const result = execute(syntheticBundle([{ name: 'PokePartyAdd', args: [258, 1] }]), world);
    expect(result.world.party).toEqual([world.pokemon[258]]);
    expect(result.world.party[0]).not.toBe(world.pokemon[258]);
    expect(world.party).toEqual([]);
  });

  it('deletes actors with a zone-scoped persistent tombstone without mutating its input', () => {
    const world = createAmxWorld(0, 75);
    world.actors[12] = { x: 50, y: 0, z: 10, direction: 0, visible: true, moveCode: 0 };
    const result = execute(syntheticBundle([{ name: 'MdlDel', args: [12] }]), world);
    expect(result.status).toBe('completed');
    expect(result.world.actors[12]).toBeUndefined();
    expect(result.world.deletedActors['75:12']).toBe(true);
    expect(world.actors[12]).toBeDefined();
    expect(world.deletedActors).toEqual({});
  });

  it('executes the actual Rusturf flag/delete instruction block at 6176..6239', () => {
    const world = createAmxWorld(0, 75);
    for (const id of [12, 13, 14]) world.actors[id] = { x: 50, y: 0, z: 10, direction: 0, visible: true, moveCode: 0 };
    const instructions: AmxInstruction[] = rusturf.programs.map.instructions.filter(row => row.offset >= 6176 && row.offset < 6240);
    const bundle: AmxBundle = { rusturf: { data: [0], stackTop: 4096,
      program: { entryPoint: 6176, dispatch: null, instructions: [...instructions,
        { offset: 6240, size: 8, mnemonic: 'halt', operands: [0] }] } } };
    const result = runAmx(bundle, createAmxState(bundle, 'rusturf', 0, world));
    expect(result.status).toBe('completed');
    expect(result.world.flags[676]).toBe(true);
    expect(result.world.actors).toEqual({});
    expect(result.world.deletedActors).toEqual({ '75:12': true, '75:13': true, '75:14': true });
    expect(result.world.effects).toEqual([]);
    expect(world.flags).toEqual({});
  });

  it('checa capacidade sem adicionar e recusa overflow', () => {
    const world = createAmxWorld(); world.bag[4] = 999;
    const result = execute(syntheticBundle([{ name: 'ItemAddCheck', args: [4, 1] }]), world);
    expect(result.world.bag[4]).toBe(999);
    expect(result.machines[0].pri).toBe(0);
  });

  it('mantém PokePartyGetParam pendente sem fabricar um valor para a consulta ROM', () => {
    const result = execute(syntheticBundle([{ name: 'PokePartyGetParam', args: [0, 8, 0] }]), createAmxWorld());
    expect(result.status).toBe('await-input');
    expect(result.awaiting).toMatchObject({ kind: 'native', effect: {
      name: 'PokePartyGetParam', channel: 'pokemon', args: [0, 8, 0],
    } });
    expect(result.world.party).toEqual([]);
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

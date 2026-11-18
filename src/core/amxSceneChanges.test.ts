import { describe, expect, it } from 'vitest';
import { createAmxWorld } from './amxMemory';
import { createAmxPublicState, runAmx } from './amxRunner';
import { readAmxSceneChanges, selectAmxSceneChange } from './amxSceneChanges';
import type { AmxBundle } from './amxTypes';

function provider(cells: number[]): AmxBundle {
  return { synthetic: { data: cells, stackTop: 4096, publics: { 1676684628: 8 },
    program: { entryPoint: 0, dispatch: null, instructions: [
      { offset: 0, size: 8, mnemonic: 'halt', operands: [0] },
      { offset: 8, size: 4, mnemonic: 'proc', operands: [] },
      { offset: 12, size: 8, mnemonic: 'const.alt', operands: [0] },
      { offset: 20, size: 8, mnemonic: 'load.s.pri', operands: [12] },
      { offset: 28, size: 8, mnemonic: 'lidx.b', operands: [2] },
      { offset: 36, size: 4, mnemonic: 'retn', operands: [] },
    ] } } };
}

describe('exports AMX e condições de mudança de cena', () => {
  it('invoca o export com argumento e limpa a pilha sem executar main', () => {
    const bundle = provider([12, 13, 14]);
    const world = createAmxWorld();
    const state = runAmx(bundle, createAmxPublicState(bundle, 'synthetic', 1676684628, [1], world));
    expect(state.status).toBe('completed');
    expect(state.machines[0].pri).toBe(13);
    expect(state.machines[0].stk).toBe(state.machines[0].stp);
    expect(world.effects).toEqual([]);
  });
  it('rejeita export ausente, endereço sem proc e argumentos que não são células', () => {
    const bundle = provider([1]);
    expect(() => createAmxPublicState(bundle, 'synthetic', 42, [], createAmxWorld())).toThrow(/export 42/);
    const bad = { synthetic: { ...bundle.synthetic, publics: { 42: 12 } } };
    expect(() => createAmxPublicState(bad, 'synthetic', 42, [], createAmxWorld())).toThrow(/entrada 12/);
    expect(() => createAmxPublicState(bundle, 'synthetic', 1676684628, [0.5], createAmxWorld())).toThrow(/célula/);
  });
  it('lê triplas pela função exportada e escolhe a primeira condição correspondente', () => {
    const world = createAmxWorld();
    world.vars[16384] = 2;
    const bundle = provider([70, 16384, 1, 71, 16384, 2, 72, 16384, 2, -1]);
    const scenes = readAmxSceneChanges(bundle, 'synthetic', world);
    expect(scenes).toEqual([{ scriptId: 70, workId: 16384, value: 1 },
      { scriptId: 71, workId: 16384, value: 2 }, { scriptId: 72, workId: 16384, value: 2 }]);
    expect(selectAmxSceneChange(scenes, world.vars)).toBe(71);
    expect(world.vars).toEqual({ 16384: 2 });
  });
  it('encerra no sentinela sem interpretar as células posteriores', () => {
    const world = createAmxWorld();
    const scenes = readAmxSceneChanges(provider([-1, 5, 6]), 'synthetic', world);
    expect(scenes).toEqual([]);
    expect(selectAmxSceneChange(scenes, world.vars)).toBeNull();
  });
  it('compara work e valor unsigned-16 e ignora o marcador de script 2000', () => {
    const scenes = readAmxSceneChanges(provider([2000, 16384, 3, 73, 16384, 65539, -1]), 'synthetic', createAmxWorld());
    expect(selectAmxSceneChange(scenes, { 16384: 65539 })).toBe(73);
    expect(selectAmxSceneChange(scenes, { 16384: 2 })).toBeNull();
  });
  it('limita a oito registros como o consumidor nativo', () => {
    const cells = Array.from({ length: 9 }, (_, index) => [70 + index, 16384, index + 1]).flat();
    const scenes = readAmxSceneChanges(provider(cells), 'synthetic', createAmxWorld());
    expect(scenes).toHaveLength(8);
    expect(selectAmxSceneChange(scenes, { 16384: 9 })).toBeNull();
  });
});

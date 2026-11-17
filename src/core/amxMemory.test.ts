import { describe, expect, it } from 'vitest';
import { createAmxMachine, readCell, writeCell } from './amxMemory';
import { executeAmxOpcode } from './amxOpcodes';
import type { AmxMachine } from './amxTypes';

const machine = (): AmxMachine => createAmxMachine('synthetic', {
  program: { entryPoint: 0, dispatch: null, instructions: [] }, data: [1, 2, 3, 4], stackTop: 128,
}, 0);

describe('memória e operações Pawn', () => {
  it('rejeita acesso fora da região alocada, endereços negativos e células desalinhadas', () => {
    const current = machine();
    expect(() => readCell(current, 40)).toThrow('AmxMemoryError');
    expect(() => writeCell(current, -4, 2)).toThrow('AmxMemoryError');
    expect(() => readCell(current, 2)).toThrow('AmxMemoryError');
    expect(() => readCell(current, 128)).toThrow('AmxMemoryError');
  });

  it('opera em células de 32 bits e divide com resto de sinal do divisor', () => {
    const current = machine();
    current.pri = 2147483647;
    executeAmxOpcode(current, { offset: 0, size: 4, mnemonic: 'add.p.c', operands: [1] });
    expect(current.pri).toBe(-2147483648);
    current.pri = -7; current.alt = 3;
    executeAmxOpcode(current, { offset: 0, size: 4, mnemonic: 'sdiv', operands: [] });
    expect([current.pri, current.alt]).toEqual([-3, 2]);
    expect(() => executeAmxOpcode(current, { offset: 0, size: 4, mnemonic: 'unknown', operands: [] })).toThrow('UnsupportedAmxOpcodeError');
  });
});

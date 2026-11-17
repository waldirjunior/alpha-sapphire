import { amxError, type AmxInstruction, type AmxMachine } from './amxTypes';
import { popCell, pushCell, readByte, readCell, writeByte, writeCell } from './amxMemory';

type Operation = (machine: AmxMachine, args: readonly number[]) => void;
const binary: Record<string, (pri: number, alt: number) => number> = {
  add: (p, a) => p + a, sub: (p, a) => p - a, 'sub.alt': (p, a) => a - p,
  smul: (p, a) => Math.imul(p, a), and: (p, a) => p & a, or: (p, a) => p | a, xor: (p, a) => p ^ a,
  shl: (p, a) => p << a, shr: (p, a) => p >>> a, sshr: (p, a) => p >> a,
  eq: (p, a) => Number(p === a), neq: (p, a) => Number(p !== a),
  sless: (p, a) => Number(p < a), sleq: (p, a) => Number(p <= a),
  sgrtr: (p, a) => Number(p > a), sgeq: (p, a) => Number(p >= a),
};
const operations: Record<string, Operation> = {
  'const.pri': (m, [v]) => { m.pri = v; }, 'const.alt': (m, [v]) => { m.alt = v; },
  'zero.pri': m => { m.pri = 0; }, 'zero.alt': m => { m.alt = 0; },
  'move.pri': m => { m.pri = m.alt; }, 'move.alt': m => { m.alt = m.pri; },
  xchg: m => { [m.pri, m.alt] = [m.alt, m.pri]; },
  'load.pri': (m, [a]) => { m.pri = readCell(m, a); }, 'load.alt': (m, [a]) => { m.alt = readCell(m, a); },
  'load.s.pri': (m, [a]) => { m.pri = readCell(m, m.frm + a); },
  'load.s.alt': (m, [a]) => { m.alt = readCell(m, m.frm + a); },
  'load.i': m => { m.pri = readCell(m, m.pri); }, 'stor.i': m => writeCell(m, m.alt, m.pri),
  'stor.pri': (m, [a]) => writeCell(m, a, m.pri), 'stor.alt': (m, [a]) => writeCell(m, a, m.alt),
  'stor.s.pri': (m, [a]) => writeCell(m, m.frm + a, m.pri),
  'stor.s.alt': (m, [a]) => writeCell(m, m.frm + a, m.alt),
  zero: (m, [a]) => writeCell(m, a, 0), 'zero.s': (m, [a]) => writeCell(m, m.frm + a, 0),
  const: (m, [a, v]) => writeCell(m, a, v), 'const.s': (m, [a, v]) => writeCell(m, m.frm + a, v),
  'addr.pri': (m, [a]) => { m.pri = m.frm + a; }, 'addr.alt': (m, [a]) => { m.alt = m.frm + a; },
  'load.both': (m, [a, b]) => { m.pri = readCell(m, a); m.alt = readCell(m, b); },
  'load.s.both': (m, [a, b]) => { m.pri = readCell(m, m.frm + a); m.alt = readCell(m, m.frm + b); },
  'push.pri': m => pushCell(m, m.pri), 'push.alt': m => pushCell(m, m.alt),
  'push.c': (m, [a]) => pushCell(m, a), push: (m, [a]) => pushCell(m, readCell(m, a)),
  'push.s': (m, [a]) => pushCell(m, readCell(m, m.frm + a)), 'push.adr': (m, [a]) => pushCell(m, m.frm + a),
  'pop.pri': m => { m.pri = popCell(m); }, 'pop.alt': m => { m.alt = popCell(m); },
  'swap.pri': m => { const v = readCell(m, m.stk); writeCell(m, m.stk, m.pri); m.pri = v; },
  'swap.alt': m => { const v = readCell(m, m.stk); writeCell(m, m.stk, m.alt); m.alt = v; },
  'add.c': (m, [v]) => { m.pri = (m.pri + v) | 0; }, 'smul.c': (m, [v]) => { m.pri = Math.imul(m.pri, v); },
  'eq.c.pri': (m, [v]) => { m.pri = Number(m.pri === v); },
  'eq.c.alt': (m, [v]) => { m.pri = Number(m.alt === v); },
  not: m => { m.pri = Number(!m.pri); }, neg: m => { m.pri = -m.pri | 0; }, invert: m => { m.pri = ~m.pri; },
  'inc.pri': m => { m.pri = m.pri + 1 | 0; }, 'dec.pri': m => { m.pri = m.pri - 1 | 0; },
  'inc.alt': m => { m.alt = m.alt + 1 | 0; }, 'dec.alt': m => { m.alt = m.alt - 1 | 0; },
  inc: (m, [a]) => writeCell(m, a, readCell(m, a) + 1), dec: (m, [a]) => writeCell(m, a, readCell(m, a) - 1),
  'inc.s': (m, [a]) => writeCell(m, m.frm + a, readCell(m, m.frm + a) + 1),
  'dec.s': (m, [a]) => writeCell(m, m.frm + a, readCell(m, m.frm + a) - 1),
  'inc.i': m => writeCell(m, m.pri, readCell(m, m.pri) + 1),
  'dec.i': m => writeCell(m, m.pri, readCell(m, m.pri) - 1),
  lidx: m => { m.pri = readCell(m, m.alt + m.pri * 4); },
  'lidx.b': (m, [shift]) => { m.pri = readCell(m, m.alt + (m.pri << shift)); },
  idxaddr: m => { m.pri = m.alt + m.pri * 4; }, 'idxaddr.b': (m, [shift]) => { m.pri = m.alt + (m.pri << shift); },
  nop: () => {}, break: () => {},
};

export const normalizeAmxOpcode = (mnemonic: string): string => mnemonic.replace(/\.p(?=\.|$)/g, '');

function adjustMemory(m: AmxMachine, op: string, amount: number): void {
  const value = op === 'stack' ? m.stk : m.hea;
  const next = value + amount;
  if (!Number.isInteger(next) || next % 4 || next < 0 || next > m.stp) amxError('AmxStackError', `${op} ${amount}`);
  if (op === 'stack') { m.alt = value; m.stk = next; } else { m.alt = value; m.hea = next; }
  if (m.stk < m.hea) amxError('AmxStackError', 'colisão stack/heap');
}
function controlRegister(m: AmxMachine, op: string, index: number): void {
  const registers = [0, 0, m.hea, m.stp, m.stk, m.frm, m.pc];
  if (op === 'lctrl' && index >= 0 && index < registers.length) { m.pri = registers[index]; return; }
  if (op === 'sctrl' && index === 2) { m.hea = m.pri; return; }
  if (op === 'sctrl' && index === 4) { m.stk = m.pri; return; }
  if (op === 'sctrl' && index === 5) { m.frm = m.pri; return; }
  if (op === 'sctrl' && index === 6) { m.pc = m.pri; return; }
  amxError('UnsupportedAmxOpcodeError', `${op} ${index}`);
}
function memoryBlock(m: AmxMachine, op: string, length: number): void {
  if (!Number.isSafeInteger(length) || length < 0 || length > m.stp) amxError('AmxMemoryError', `bloco ${length}`);
  if (op === 'fill') {
    for (let i = 0; i < length; i += 1) writeByte(m, m.alt + i, m.pri >>> ((i % 4) * 8));
    return;
  }
  const source = Array.from({ length }, (_, i) => readByte(m, m.pri + i));
  if (op === 'movs') { source.forEach((byte, i) => writeByte(m, m.alt + i, byte)); return; }
  m.pri = 0;
  for (let i = 0; i < length; i += 1) {
    const delta = source[i] - readByte(m, m.alt + i);
    if (delta) { m.pri = delta; return; }
  }
}
export function executeAmxOpcode(m: AmxMachine, row: AmxInstruction): void {
  const op = normalizeAmxOpcode(row.mnemonic), args = row.operands;
  if (Object.hasOwn(operations, op)) { operations[op](m, args); return; }
  if (Object.hasOwn(binary, op)) { m.pri = binary[op](m.pri, m.alt) | 0; return; }
  if (op === 'stack' || op === 'heap') { adjustMemory(m, op, args[0]); return; }
  if (op === 'lctrl' || op === 'sctrl') { controlRegister(m, op, args[0]); return; }
  if (op === 'movs' || op === 'cmps' || op === 'fill') { memoryBlock(m, op, args[0]); return; }
  if (op === 'bounds') { if ((m.pri >>> 0) > (args[0] >>> 0)) amxError('AmxBoundsError', `${m.pri} > ${args[0]}`); return; }
  const multi = /^push([2-5])(?:\.(c|s|adr))?$/.exec(op);
  if (multi && args.length === Number(multi[1])) {
    for (const value of args) operations[`push${multi[2] ? `.${multi[2]}` : ''}`](m, [value]);
    return;
  }
  if (op === 'sdiv' || op === 'sdiv.alt') {
    const a = op === 'sdiv' ? m.pri : m.alt, b = op === 'sdiv' ? m.alt : m.pri;
    if (!b) amxError('AmxArithmeticError', 'divisão por zero');
    m.pri = Math.floor(a / b) | 0; m.alt = a - m.pri * b | 0; return;
  }
  amxError('UnsupportedAmxOpcodeError', `${row.offset}: ${row.mnemonic}`);
}

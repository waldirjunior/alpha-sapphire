import { amxError, type AmxBundle, type AmxInput, type AmxInstruction, type AmxMachine, type AmxState, type AmxWorld } from './amxTypes';
import { cloneAmxState, createAmxMachine, popCell, pushCell, readCell, writeCell } from './amxMemory';
import { executeAmxOpcode, normalizeAmxOpcode } from './amxOpcodes';
import { executeAmxNative } from './amxEffects';

export function createAmxState(bundle: AmxBundle, id: string, scriptId: number, world: AmxWorld): AmxState {
  const image = Object.hasOwn(bundle, id) ? bundle[id] : undefined;
  if (!image) amxError('AmxProgramError', `programa ${id} não fornecido`);
  return cloneAmxState({ machines: [createAmxMachine(id, image, scriptId)], world,
    status: 'running', awaiting: null });
}

export function createAmxPublicState(bundle: AmxBundle, id: string, identifier: number, args: readonly number[], world: AmxWorld): AmxState {
  const image = Object.hasOwn(bundle, id) ? bundle[id] : undefined;
  if (!image) amxError('AmxProgramError', `programa ${id} não fornecido`);
  const entryPoint = image.publics?.[String(identifier)];
  if (entryPoint === undefined) amxError('AmxProgramError', `${id}: export ${identifier} ausente`);
  if (!image.program.instructions.some(row => row.offset === entryPoint && row.mnemonic === 'proc')) {
    amxError('AmxProgramError', `${id}: entrada ${entryPoint} do export ${identifier} sem proc`);
  }
  args.forEach(inputCell);
  return cloneAmxState({ machines: [createAmxMachine(id, image, -1, args, entryPoint)], world,
    status: 'running', awaiting: null });
}

const branches: Readonly<Record<string, (pri: number, alt: number) => boolean>> = {
  jump: () => true, jrel: () => true, jzer: p => p === 0, jnz: p => p !== 0,
  jeq: (p, a) => p === a, jneq: (p, a) => p !== a,
  jsless: (p, a) => p < a, jsleq: (p, a) => p <= a, jsgrtr: (p, a) => p > a, jsgeq: (p, a) => p >= a,
  jless: (p, a) => (p >>> 0) < (a >>> 0), jleq: (p, a) => (p >>> 0) <= (a >>> 0),
  jgrtr: (p, a) => (p >>> 0) > (a >>> 0), jgeq: (p, a) => (p >>> 0) >= (a >>> 0),
};
function target(row: AmxInstruction): number {
  return row.target ?? amxError('AmxProgramError', `target ausente em ${row.offset}`);
}
function returnFromFunction(state: AmxState, cleanArgs: boolean): void {
  const machine = state.machines[state.machines.length - 1];
  machine.stk = machine.frm;
  machine.frm = popCell(machine);
  machine.pc = popCell(machine);
  if (cleanArgs) {
    const bytes = popCell(machine);
    if (bytes < 0 || bytes % 4 || machine.stk + bytes > machine.stp) amxError('AmxStackError', `RETN ${bytes}`);
    machine.stk += bytes;
  }
  if (machine.pc === -1) finishMachine(state);
}
function finishMachine(state: AmxState): void {
  if (state.machines.length === 1) { state.status = 'completed'; return; }
  const completed = state.machines[state.machines.length - 1];
  state.machines.pop();
  const parent = state.machines[state.machines.length - 1];
  parent.pri = completed.pri;
  parent.childParams = { ...completed.parentParams };
}
function globalCall(bundle: AmxBundle, state: AmxState, args: number[]): void {
  if (args.length !== 1) amxError('AmxNativeSignatureError', `GlobalCall: ${args.length}`);
  const matches = Object.entries(bundle).filter(([id, image]) => id.startsWith('global:') &&
    image.program.dispatch?.cases.some(row => row.value === args[0]));
  if (matches.length !== 1) amxError('AmxGlobalCallError', `ID ${args[0]}: ${matches.length} candidatos no bundle`);
  if (state.machines.length >= 64) amxError('AmxStackError', 'GlobalCall excede 64 invocações');
  const [id, image] = matches[0];
  const child = createAmxMachine(id, image, args[0]);
  child.parentParams = { ...state.machines[state.machines.length - 1].childParams };
  state.machines.push(child);
}
function invokeNative(bundle: AmxBundle, state: AmxState, row: AmxInstruction): void {
  const machine = state.machines[state.machines.length - 1];
  const bytes = row.argumentBytes;
  if (bytes === undefined || bytes < 0 || bytes % 4) amxError('AmxNativeSignatureError', `argumentBytes ${bytes}`);
  const args = Array.from({ length: bytes / 4 }, (_, index) => readCell(machine, machine.stk + index * 4));
  machine.stk += bytes;
  if (row.native?.name === 'GlobalCall') { globalCall(bundle, state, args); return; }
  executeAmxNative(state, row, args);
}
function switchCase(machine: AmxMachine, row: AmxInstruction, instructions: ReadonlyMap<number, AmxInstruction>): void {
  const table = instructions.get(target(row));
  if (!table?.cases || table.defaultTarget === undefined) amxError('AmxProgramError', `casetbl ausente em ${row.offset}`);
  machine.pc = table.cases.find(entry => entry.value === machine.pri)?.target ?? table.defaultTarget;
}
function halt(state: AmxState, code: number): void {
  if (code === 0) { finishMachine(state); return; }
  if (code !== 12) amxError('AmxHaltError', `HALT ${code}`);
  state.awaiting = { kind: 'ticks', remaining: state.world.suspendTicks };
  state.world.suspendTicks = 0;
  state.status = 'await-input';
}
function stepAmx(bundle: AmxBundle, state: AmxState, instructions: ReadonlyMap<number, AmxInstruction>): void {
  const machine = state.machines[state.machines.length - 1];
  const row = instructions.get(machine.pc) ?? amxError('AmxProgramError', `${machine.programId}: pc ${machine.pc}`);
  const op = normalizeAmxOpcode(row.mnemonic);
  machine.pc += row.size;
  if (Object.hasOwn(branches, op)) { if (branches[op](machine.pri, machine.alt)) machine.pc = target(row); return; }
  if (op === 'proc') { pushCell(machine, machine.frm); machine.frm = machine.stk; return; }
  if (op === 'call') { pushCell(machine, machine.pc); machine.pc = target(row); return; }
  if (op === 'retn' || op === 'ret') { returnFromFunction(state, op === 'retn'); return; }
  if (op === 'switch') { switchCase(machine, row, instructions); return; }
  if (op === 'halt') { halt(state, row.operands[0]); return; }
  if (op === 'sysreq.n') { invokeNative(bundle, state, row); return; }
  executeAmxOpcode(machine, row);
}
export function runAmx(bundle: AmxBundle, state: AmxState, budget = 100000): AmxState {
  if (!Number.isSafeInteger(budget) || budget <= 0) amxError('AmxBudgetError', `${budget}`);
  const next = cloneAmxState(state);
  const indexes = new Map(Object.entries(bundle).map(([id, image]) =>
    [id, new Map(image.program.instructions.map(row => [row.offset, row]))]));
  for (let steps = 0; next.status === 'running'; steps += 1) {
    if (steps >= budget) amxError('AmxExecutionLimitError', `orçamento ${budget}`);
    const id = next.machines[next.machines.length - 1].programId;
    const instructions = indexes.get(id) ?? amxError('AmxProgramError', id);
    stepAmx(bundle, next, instructions);
  }
  return next;
}
function inputCell(value: number): number {
  if (!Number.isInteger(value) || (value | 0) !== value) amxError('AmxInputError', `célula ${value}`);
  return value;
}
function applyNativeResult(state: AmxState, input: Extract<AmxInput, { kind: 'native-result' }>): void {
  const machine = state.machines[state.machines.length - 1];
  machine.pri = inputCell(input.value);
  for (const write of input.writes ?? []) writeCell(machine, write.address, inputCell(write.value));
}
export function resumeAmx(state: AmxState, input: AmxInput): AmxState {
  if (state.status !== 'await-input' || !state.awaiting) amxError('AmxInputError', 'não há pedido pendente');
  const next = cloneAmxState(state);
  const awaiting = state.awaiting;
  if (awaiting.kind === 'ticks' && input.kind === 'ticks') {
    if (!Number.isSafeInteger(input.count) || input.count < 0) amxError('AmxInputError', `ticks ${input.count}`);
    const remaining = Math.max(0, awaiting.remaining - input.count);
    if (remaining) { next.awaiting = { kind: 'ticks', remaining }; return next; }
  } else if (awaiting.kind === 'native' && input.kind === 'native-result') {
    applyNativeResult(next, input);
  } else amxError('AmxInputError', `pedido ${awaiting.kind}, resposta ${input.kind}`);
  next.status = 'running'; next.awaiting = null;
  return next;
}

import { amxError, type AmxMachine, type AmxImage, type AmxState, type AmxWorld } from './amxTypes';

export function checkAddress(machine: AmxMachine, address: number, length = 4): void {
  if (!Number.isSafeInteger(address) || address < 0 || address + length > machine.stp ||
      (address < machine.stk && address + length > machine.hea)) {
    amxError('AmxMemoryError', `endereço ${address}, tamanho ${length}, limite ${machine.stp}`);
  }
}
export function readCell(machine: AmxMachine, address: number): number {
  checkAddress(machine, address);
  if (address % 4) amxError('AmxMemoryError', `célula desalinhada ${address}`);
  return machine.memory[address] ?? 0;
}
export function writeCell(machine: AmxMachine, address: number, value: number): void {
  readCell(machine, address);
  machine.memory[address] = value | 0;
}
export function pushCell(machine: AmxMachine, value: number): void {
  if (machine.stk - 4 < machine.hea) amxError('AmxStackError', 'colisão stack/heap');
  machine.stk -= 4;
  writeCell(machine, machine.stk, value);
}
export function popCell(machine: AmxMachine): number {
  const value = readCell(machine, machine.stk);
  machine.stk += 4;
  return value;
}
export function readByte(machine: AmxMachine, address: number): number {
  checkAddress(machine, address, 1);
  return (readCell(machine, address & ~3) >>> ((address & 3) * 8)) & 255;
}
export function writeByte(machine: AmxMachine, address: number, value: number): void {
  const shift = (address & 3) * 8;
  const base = address & ~3;
  writeCell(machine, base, (readCell(machine, base) & ~(255 << shift)) | ((value & 255) << shift));
}
export function createAmxMachine(id: string, image: AmxImage, scriptId: number, args: readonly number[] = [], entryPoint = image.program.entryPoint): AmxMachine {
  const memory = Object.fromEntries(image.data.map((value, index) => [index * 4, value | 0]));
  const machine: AmxMachine = { programId: id, pc: entryPoint, pri: 0, alt: 0, frm: 0,
    stk: image.stackTop, stp: image.stackTop, hea: image.data.length * 4, memory, childParams: {}, parentParams: {} };
  if (image.program.dispatch) writeCell(machine, image.program.dispatch.selectorAddress, scriptId);
  for (const arg of [...args].reverse()) pushCell(machine, arg);
  pushCell(machine, args.length * 4);
  pushCell(machine, -1);
  return machine;
}
export function createAmxWorld(sex: 0 | 1 = 0, zoneId = 0): AmxWorld {
  return { flags: {}, vars: {}, actors: {}, bag: {}, party: [], box: [], pokemon: {}, dex: {}, sex, zoneId,
    warpId: null, dialogue: null, effects: [], suspendTicks: 0 };
}
export function cloneAmxState(state: AmxState): AmxState {
  return { ...state, machines: state.machines.map(machine => ({ ...machine, memory: { ...machine.memory },
    childParams: { ...machine.childParams }, parentParams: { ...machine.parentParams } })),
    world: { ...state.world, flags: { ...state.world.flags }, vars: { ...state.world.vars }, bag: { ...state.world.bag },
      actors: Object.fromEntries(Object.entries(state.world.actors).map(([id, actor]) => [id, { ...actor }])),
      party: state.world.party.map(poke => ({ ...poke })), box: state.world.box.map(poke => ({ ...poke })),
      pokemon: Object.fromEntries(Object.entries(state.world.pokemon).map(([id, poke]) => [id, { ...poke }])),
      dex: { ...state.world.dex }, effects: [...state.world.effects] } };
}
export function floatFromCell(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setInt32(0, value, true);
  return view.getFloat32(0, true);
}
export function cellFromFloat(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getInt32(0, true);
}

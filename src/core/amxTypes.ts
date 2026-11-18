export interface AmxInstruction {
  offset: number; size: number; mnemonic: string; operands: readonly number[];
  target?: number; defaultTarget?: number; cases?: readonly { value: number; target: number }[];
  native?: { name: string | null; hash: string }; argumentBytes?: number;
}
export interface AmxProgram {
  entryPoint: number; instructions: readonly AmxInstruction[];
  dispatch: { selectorAddress: number; cases: readonly { value: number; target: number }[] } | null;
}
export interface AmxImage {
  program: AmxProgram; data: readonly number[]; stackTop: number;
}
export type AmxBundle = Readonly<Record<string, AmxImage>>;
export interface AmxMachine {
  programId: string; pc: number; pri: number; alt: number; frm: number;
  stk: number; hea: number; stp: number; memory: Record<number, number>;
  childParams: Record<number, number>; parentParams: Record<number, number>;
}
export interface AmxActor { x: number; y: number; z: number; direction: number; visible: boolean; moveCode: number }
export interface AmxPokemon {
  handle: number; species: number; hp: number; maxHp: number; isEgg: boolean; nickname: string; status: number;
}
export type AmxEffectChannel = 'dialogue' | 'choice' | 'movement' | 'camera' | 'fade' | 'audio' | 'field' | 'actor' | 'words' | 'pokemon' | 'ui';
export interface AmxEffect { channel: AmxEffectChannel; name: string; args: readonly number[] }
export type AmxAwait = { kind: 'native'; effect: AmxEffect } | { kind: 'ticks'; remaining: number };
export interface AmxWorld {
  flags: Record<number, boolean>; vars: Record<number, number>; actors: Record<number, AmxActor>;
  deletedActors: Record<string, boolean>;
  bag: Record<number, number>; party: AmxPokemon[]; box: AmxPokemon[]; pokemon: Record<number, AmxPokemon>;
  dex: Record<number, boolean>; sex: 0 | 1; zoneId: number; warpId: number | null;
  dialogue: readonly number[] | null; effects: AmxEffect[]; suspendTicks: number;
}
export interface AmxState {
  machines: AmxMachine[]; world: AmxWorld;
  status: 'running' | 'await-input' | 'completed'; awaiting: AmxAwait | null;
}
export type AmxInput =
  | { kind: 'native-result'; value: number; writes?: readonly { address: number; value: number }[] }
  | { kind: 'ticks'; count: number };

export function amxError(name: string, detail: string): never {
  const error = new Error(`${name}: ${detail}`);
  error.name = name;
  throw error;
}

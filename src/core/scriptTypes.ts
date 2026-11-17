export interface ScriptPosition { x: number; y: number; z: number }
export interface ScriptActor extends ScriptPosition { visible: boolean; direction: number }
export type ScriptCommand =
  | { kind: 'native'; name: string; args: readonly number[] }
  | { kind: 'jump'; target: number }
  | { kind: 'stop' };
export interface ScriptContext {
  texts: Readonly<Record<number, string>>;
  warps: Readonly<Record<string, ScriptPosition>>;
}
export interface ScriptState {
  pc: number;
  zoneId: number;
  actors: Readonly<Record<number, ScriptActor>>;
  dialogue: string | null;
  status: 'running' | 'waiting-input' | 'waiting-ticks' | 'completed';
  ticksRemaining: number;
}

export class UnsupportedScriptNativeError extends Error {
  constructor(name: string) {
    super(`UnsupportedScriptNativeError: ${name}`);
    this.name = 'UnsupportedScriptNativeError';
  }
}

export function invalidScript(message: string): never {
  throw new Error(`InvalidScriptInstructionError: ${message}`);
}

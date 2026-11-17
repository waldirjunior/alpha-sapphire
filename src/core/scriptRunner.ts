import { executeScriptNative } from './scriptNatives';
import { invalidScript, type ScriptActor, type ScriptCommand, type ScriptContext, type ScriptState } from './scriptTypes';
export { UnsupportedScriptNativeError } from './scriptTypes';

export function createScriptState(zoneId: number, actors: Readonly<Record<number, ScriptActor>>): ScriptState {
  return { zoneId, actors: Object.fromEntries(Object.entries(actors).map(([id, value]) => [id, { ...value }])),
    pc: 0, dialogue: null, status: 'running', ticksRemaining: 0 };
}

export function resumeScript(state: ScriptState, ticks = 0): ScriptState {
  if (!Number.isSafeInteger(ticks) || ticks < 0) invalidScript(`ticks ${ticks}`);
  if (state.status === 'waiting-input') return { ...state, status: 'running' };
  if (state.status !== 'waiting-ticks') return state;
  const remaining = Math.max(0, state.ticksRemaining - ticks);
  return { ...state, ticksRemaining: remaining, status: remaining ? 'waiting-ticks' : 'running' };
}

function executeCommand(program: readonly ScriptCommand[], state: ScriptState, context: ScriptContext): ScriptState {
  const command = program[state.pc] ?? invalidScript(`pc ${state.pc} fora do programa`);
  if (command.kind === 'stop') return { ...state, status: 'completed' };
  if (command.kind === 'jump') {
    if (!Number.isInteger(command.target) || command.target < 0 || command.target >= program.length) invalidScript(`jump ${command.target}`);
    return { ...state, pc: command.target };
  }
  const next = executeScriptNative(state, command.name, command.args, context);
  return { ...next, pc: state.pc + 1 };
}

export function runScript(program: readonly ScriptCommand[], state: ScriptState, context: ScriptContext, budget = 1000): ScriptState {
  if (!Number.isSafeInteger(budget) || budget <= 0) invalidScript(`budget ${budget}`);
  let current = state;
  for (let steps = 0; current.status === 'running'; steps += 1) {
    if (steps >= budget) throw new Error(`ScriptExecutionLimitError: limite ${budget}, pc ${current.pc}`);
    current = executeCommand(program, current, context);
  }
  return current;
}

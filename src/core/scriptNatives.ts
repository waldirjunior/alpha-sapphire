import { invalidScript, UnsupportedScriptNativeError, type ScriptContext, type ScriptState, type ScriptActor } from './scriptTypes';

type Native = (state: ScriptState, args: readonly number[], context: ScriptContext) => ScriptState;

function actor(state: ScriptState, id: number): ScriptActor {
  return state.actors[id] ?? invalidScript(`ator ${id} inexistente`);
}

function updateActor(state: ScriptState, id: number, update: Partial<ScriptActor>): ScriptState {
  return { ...state, actors: { ...state.actors, [id]: { ...actor(state, id), ...update } } };
}

const NATIVES: Record<string, { arity: number; execute: Native }> = {
  CommandNOP: { arity: 0, execute: state => state },
  MdlSetGPos: { arity: 4, execute: (state, [id, x, y, z]) => updateActor(state, id, { x, y, z }) },
  MdlSetDirDisp: { arity: 2, execute: (state, [id, direction]) => {
    if (!Number.isInteger(direction) || direction < 0 || direction > 3) invalidScript(`direção ${direction}`);
    return updateActor(state, id, { direction });
  } },
  MdlSetVisible: { arity: 2, execute: (state, [id, visible]) => {
    if (visible !== 0 && visible !== 1) invalidScript(`visibilidade ${visible}`);
    return updateActor(state, id, { visible: visible === 1 });
  } },
  TalkMdlMsg_Seq: { arity: 1, execute: (state, [id], context) => {
    const dialogue = context.texts[id] ?? invalidScript(`texto ${id} inexistente`);
    return { ...state, dialogue };
  } },
  MsgWinAllClose: { arity: 0, execute: state => ({ ...state, dialogue: null }) },
  _ABKeyWait: { arity: 0, execute: state => ({ ...state, status: 'waiting-input' }) },
  _Suspend: { arity: 1, execute: (state, [ticks]) => {
    if (!Number.isSafeInteger(ticks) || ticks < 0) invalidScript(`ticks ${ticks}`);
    return { ...state, ticksRemaining: ticks, status: ticks ? 'waiting-ticks' : 'running' };
  } },
  WarpSetID: { arity: 2, execute: (state, [zoneId, warpId], context) => {
    const position = context.warps[`${zoneId}:${warpId}`] ?? invalidScript(`warp ${zoneId}:${warpId} inexistente`);
    return { ...updateActor(state, 255, position), zoneId };
  } },
};

export function executeScriptNative(state: ScriptState, name: string, args: readonly number[], context: ScriptContext): ScriptState {
  const native = Object.hasOwn(NATIVES, name) ? NATIVES[name] : undefined;
  if (!native) throw new UnsupportedScriptNativeError(name);
  if (args.length !== native.arity || args.some(value => !Number.isFinite(value))) {
    invalidScript(`${name}: esperado ${native.arity} argumentos finitos; recebido ${args}`);
  }
  return native.execute(state, args, context);
}

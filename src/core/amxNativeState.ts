import { amxError, type AmxActor, type AmxMachine, type AmxWorld } from './amxTypes';
import { cellFromFloat, floatFromCell } from './amxMemory';
import { actorDeletionKey } from './amxProgress';

type Native = (world: AmxWorld, args: readonly number[], machine: AmxMachine) => number;
export interface AmxNativeDefinition { arity: number; execute: Native }
function actor(world: AmxWorld, id: number): AmxActor {
  return world.actors[id] ?? amxError('AmxActorError', `ator ${id} não fornecido`);
}
function addItem(world: AmxWorld, [id, count]: readonly number[], mutate: boolean): number {
  if (!Number.isInteger(count) || count < 0) amxError('AmxInventoryError', `quantidade ${count}`);
  const total = (world.bag[id] ?? 0) + count;
  if (total > 999) return 0;
  if (mutate) world.bag[id] = total;
  return 1;
}
function changeFace(world: AmxWorld, [id, expression]: readonly number[]): number {
  const target = world.actors[id & 0xffff];
  const value = expression & 0xff;
  if (target) target.faceExpression = value <= 7 ? value : 0;
  return 0;
}
export const stateNatives: Readonly<Record<string, AmxNativeDefinition>> = {
  ChangeFace: { arity: 2, execute: changeFace },
  CommandNOP: { arity: 0, execute: () => 0 },
  float: { arity: 1, execute: (_w, [value]) => cellFromFloat(value) },
  floatadd: { arity: 2, execute: (_w, [left, right]) => cellFromFloat(floatFromCell(left) + floatFromCell(right)) },
  BuildMdlGetHandleByGPos: { arity: 2, execute: (_w, [x, z]) => ((x << 16) + z) | 0 },
  FlagGet: { arity: 1, execute: (w, [id]) => Number(w.flags[id] ?? false) },
  FlagSet: { arity: 1, execute: (w, [id]) => { w.flags[id] = true; return 0; } },
  FlagReset: { arity: 1, execute: (w, [id]) => { w.flags[id] = false; return 0; } },
  WorkGet: { arity: 1, execute: (w, [id]) => (w.vars[id & 0xffff] ?? 0) & 0xffff },
  WorkSet: { arity: 2, execute: (w, [id, value]) => { w.vars[id & 0xffff] = value & 0xffff; return 0; } },
  GlobalSetChildParam: { arity: 2, execute: (_w, [id, value], m) => { m.childParams[id] = value; return 0; } },
  GlobalGetChildParam: { arity: 1, execute: (_w, [id], m) => m.childParams[id] ?? 0 },
  GlobalSetParentParam: { arity: 2, execute: (_w, [id, value], m) => { m.parentParams[id] = value; return 0; } },
  GlobalGetParentParam: { arity: 1, execute: (_w, [id], m) => m.parentParams[id] ?? 0 },
  PlayerGetSex: { arity: 0, execute: w => w.sex },
  PlayerGetZoneID: { arity: 0, execute: w => w.zoneId },
  PlayerGetReturnDir: { arity: 0, execute: w => actor(w, 255).direction },
  MdlGetDirDisp: { arity: 1, execute: (w, [id]) => actor(w, id).direction },
  MdlSetDirDisp: { arity: 2, execute: (w, [id, direction]) => { actor(w, id).direction = direction; return 0; } },
  MdlSetVisible: { arity: 2, execute: (w, [id, visible]) => { actor(w, id).visible = !!visible; return 0; } },
  MdlDel: { arity: 1, execute: (w, [id]) => {
    delete w.actors[id];
    w.deletedActors[actorDeletionKey(w.zoneId, id)] = true;
    return 0;
  } },
  MdlSetGPos: { arity: 4, execute: (w, [x, y, z, id]) => { Object.assign(actor(w, id), { x, y, z }); return 0; } },
  MdlGetGPosX: { arity: 1, execute: (w, [id]) => cellFromFloat(actor(w, id).x) },
  MdlGetGPosZ: { arity: 1, execute: (w, [id]) => cellFromFloat(actor(w, id).z) },
  MdlGetMoveCode: { arity: 1, execute: (w, [id]) => actor(w, id).moveCode },
  MdlChangeMoveCode: { arity: 2, execute: (w, [id, code]) => { actor(w, id).moveCode = code; return 0; } },
  ItemAddCheck: { arity: 2, execute: (w, args) => addItem(w, args, false) },
  ItemAdd: { arity: 2, execute: (w, args) => addItem(w, args, true) },
  PokePartyGetCount: { arity: 1, execute: (w, [excludeEgg]) => w.party.filter(p => !excludeEgg || !p.isEgg).length },
  PokePartyRecoverAll: { arity: 0, execute: w => {
    w.party.forEach(p => { p.hp = p.maxHp; p.status = 0; w.pokemon[p.handle] = { ...p }; });
    return 0;
  } },
  PokePartyAdd: { arity: 2, execute: (w, [handle, mode]) => {
    if (mode !== 0 && mode !== 1) amxError('AmxNativeSignatureError', `PokePartyAdd modo ${mode} não implementado`);
    const poke = w.pokemon[handle] ?? amxError('AmxPokemonError', `handle ${handle} não fornecido`);
    if (w.party.length >= 6) return 0;
    w.party.push({ ...poke }); return 1;
  } },
  BoxAddPoke: { arity: 1, execute: (w, [handle]) => {
    const poke = w.pokemon[handle] ?? amxError('AmxPokemonError', `handle ${handle} não fornecido`);
    w.box.push({ ...poke }); return 1;
  } },
  ZukanGetOpenFlag: { arity: 1, execute: (w, [id]) => Number(w.dex[id] ?? false) },
  ZukanSetOpenFlag: { arity: 2, execute: (w, [id, flag]) => { w.dex[id] = !!flag; return 0; } },
  WarpSetID: { arity: 1, execute: (w, [id]) => { w.warpId = id; return 0; } },
  MsgWinCloseNo: { arity: 1, execute: w => { w.dialogue = null; return 0; } },
  MsgWinAllClose: { arity: 0, execute: w => { w.dialogue = null; return 0; } },
  CheckWinAllSuspend: { arity: 0, execute: () => 1 },
  _Suspend: { arity: 1, execute: (w, [ticks]) => {
    if (ticks < 0) amxError('AmxNativeSignatureError', `_Suspend ${ticks}`);
    w.suspendTicks = ticks; return 0;
  } },
  floatround: { arity: 2, execute: (_w, [bits, mode]) => {
    const value = floatFromCell(bits);
    const rounding = [Math.round, Math.floor, Math.ceil, Math.trunc][mode];
    if (!rounding || !Number.isFinite(value)) amxError('AmxArithmeticError', `floatround ${bits}, modo ${mode}`);
    return rounding(value) | 0;
  } },
};

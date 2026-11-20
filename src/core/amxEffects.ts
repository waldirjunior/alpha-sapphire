import type { AmxEffectChannel, AmxInstruction, AmxState } from './amxTypes';
import { amxError } from './amxTypes';
import { stateNatives } from './amxNativeState';
import { UnsupportedScriptNativeError } from './scriptTypes';

const groups: Readonly<Record<AmxEffectChannel, Readonly<Record<string, number>>>> = {
  dialogue: { TalkMdlMsg_Seq: 19, LastKeyWait: 0, _ABKeyWait: 0 },
  choice: { YesNoWin_Seq: 4, _CallPoke3Select: 1, CallPokePartyNameInput: 5 },
  movement: { MdlAcmdInit: 1, MdlAcmdSet: 4, MdlAcmdSetEnd: 0, MdlAcmdUpdate: 1,
    MdlAcmdMakeMoveEx: 7, MdlCanUseTurnAcmd: 1, MdlIsHalfSitSkelPreset: 1, MdlSpMotionUpdate: 1 },
  camera: { EVCameraBegin: 0, EVCameraEnd: 1, EVCameraIsEndFrame: 0, EVCameraSetDstParam: 9,
    EVCameraSetFrameParam: 4, EVCameraSetGameCameraParam: 0, EVCameraSetInitParam: 0, EVCameraSetSlideParam: 9 },
  fade: { FadeIsEnd: 0, FadeRequestOut: 3, _FadeRequestIn: 2 },
  audio: { SEPlay: 1, SEIsPlaying: 1, MEPlay: 1, MEIsFinished: 1, MEReturnBGM: 0,
    BGMChangeNowMap: 2, VoicePlay: 2, VoiceIsEnd: 0 },
  field: { _FieldMapBlockIsLoading: 0, _MapChangeCore: 9, _FieldClose: 2,
    BGParamPosChange: 4, PlaceNameSetNotCloseFlag: 1, ContactEncountStart: 8,
    ContactEncountIsActive: 0, ContactEncountEnd: 0 },
  actor: { _TalkMdlStartInit: 4, _TalkMdlEndInit: 2, TalkMdlClearEye: 1, TalkMdlClearEyeToEye: 1,
    TalkMdlSetEye: 3, TalkMdlSetEyeToEye: 1, TalkMdlSetTalkMotion: 1, MdlSetWaitAnimeReq: 1,
    MdlAdd: 1, _MdlProperties: 2, MdlParamPosChange: 5,
    BuildMdlEventAnimeInvStart: 4, BuildMdlEventAnimeIsEnd: 2, BuildMdlEventAnimeSetEnd: 2,
    BuildMdlEventAnimeStart: 3, BuildMdlEventAnimeStop: 2,
    MdlInterestViewClear: 1, MdlInterestViewSet: 4, MdlInterestViewSetMode: 2,
    GetDirAddValueGridX: 2, GetDirAddValueGridZ: 2, CalcVecToDir: 2 },
  words: { _WordSetRegister: 3, WordSetItemName: 3, WordSetItemPocketName: 2, WordSetItemWazaName: 2,
    WordSetTemotiMonsNickName: 2 },
  pokemon: { BoxIsFull: 0, PokePartySetDefaultName: 1, PokeMemorySet: 3,
    _CallWildBattleWithoutField: 4, RecordAdd: 2, PokePartyGetParam: 3,
    _CallTrainerBattleCore: 7, BadgeGetFlag: 1, BadgeSetFlag: 1, GymSetVictoryInfo: 1 },
  ui: { SetKeyWaitMark: 0, VanishKeyWaitMark: 0, IsKeyTrigger: 3, PlayerSetFieldMenu: 2,
    MsgIsLoaded: 1, MsgLoad: 2, MsgRelease: 0, MsgSwap: 0, PocketGetID: 1, ItemIsMegaStone: 1,
    FieldMenuPopPage: 0, FieldMenuPushPage: 1, SpMotionDelete: 0, SpMotionLoadIsEnd: 0,
    SpMotionPlay: 3, SpMotionReqLoad: 1, SpMotionSetup: 0 },
};
const channels: readonly AmxEffectChannel[] = ['dialogue', 'choice', 'movement', 'camera', 'fade', 'audio', 'field', 'actor', 'words', 'pokemon', 'ui'];
const effectDefinitions = channels.flatMap(channel =>
  Object.entries(groups[channel]).map(([name, arity]) => ({ name, channel, arity })));

export function getAmxNativeSignature(name: string): { arity: number; channel: string } | undefined {
  if (name === 'GlobalCall') return { arity: 1, channel: 'global' };
  if (Object.hasOwn(stateNatives, name)) return { arity: stateNatives[name].arity, channel: 'state' };
  const effect = effectDefinitions.find(entry => entry.name === name);
  return effect && { arity: effect.arity, channel: effect.channel };
}

export function executeAmxNative(state: AmxState, row: AmxInstruction, args: number[]): void {
  const name = row.native?.name ?? `hash:${row.native?.hash}`;
  const native = Object.hasOwn(stateNatives, name) ? stateNatives[name] : undefined;
  const effect = effectDefinitions.find(entry => entry.name === name);
  if (!native && !effect) throw new UnsupportedScriptNativeError(name);
  const arity = native?.arity ?? effect?.arity;
  if (arity !== args.length) amxError('AmxNativeSignatureError', `${name}: ${args.length}, esperado ${arity}`);
  const machine = state.machines[state.machines.length - 1];
  if (native) { machine.pri = native.execute(state.world, args, machine) | 0; return; }
  if (!effect) throw new UnsupportedScriptNativeError(name);
  requestEffect(state, name, args, effect.channel);
}
function requestEffect(state: AmxState, name: string, args: number[], channel: AmxEffectChannel): void {
  const effect = { channel, name, args };
  if (name === 'TalkMdlMsg_Seq') state.world.dialogue = [...args];
  state.world.effects.push(effect);
  state.awaiting = { kind: 'native', effect };
  state.status = 'await-input';
}

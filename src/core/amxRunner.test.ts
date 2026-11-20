import { describe, expect, it } from 'vitest';
import zone6 from '../data/zone_scripts/0006.json';
import zone223 from '../data/zone_scripts/0223.json';
import zone225 from '../data/zone_scripts/0225.json';
import zone227 from '../data/zone_scripts/0227.json';
import global78 from '../data/zone_scripts/global_0078.json';
import global47 from '../data/zone_scripts/global_0047.json';
import route101 from '../data/zone_scripts/0023.json';
import roxanne from '../data/zone_scripts/0441.json';
import opening from '../data/zone_scripts/opening-memory.json';
import { createAmxState, runAmx, resumeAmx } from './amxRunner';
import { createAmxWorld } from './amxMemory';
import { getAmxNativeSignature } from './amxEffects';
import type { AmxBundle, AmxProgram } from './amxTypes';

const memory: Readonly<Record<string, { data: number[]; stackTop: number; sha256: string }>> = opening.images;
const image = (id: string, program: AmxProgram) => ({ program, data: memory[id].data, stackTop: memory[id].stackTop });
const bundle: AmxBundle = {
  'zone:0006:map': image('zone:0006:map', zone6.programs.map),
  'zone:0006:entities': image('zone:0006:entities', zone6.programs.entities),
  'zone:0223:map': image('zone:0223:map', zone223.programs.map),
  'zone:0223:entities': image('zone:0223:entities', zone223.programs.entities),
  'zone:0225:entities': image('zone:0225:entities', zone225.programs.entities),
  'zone:0227:map': image('zone:0227:map', zone227.programs.map),
  'global:0078': image('global:0078', global78),
  'global:0047': image('global:0047', global47),
  'zone:0023:map': image('zone:0023:map', route101.programs.map),
};
const actor = { x: 0, y: 0, z: 0, direction: 0, visible: true, moveCode: 0 };

describe('VM Pawn com disassembly real ORAS', () => {
  it('init de Littleroot calcula handles de construção e para apenas na animação externa', () => {
    const result = runAmx(bundle, createAmxState(bundle, 'zone:0006:entities', 1, createAmxWorld()));
    expect(result.awaiting).toMatchObject({ kind: 'native', effect: { name: 'BuildMdlEventAnimeSetEnd' } });
  });
  it.each(['zone:0223:entities', 'zone:0225:entities'])('executa init real de %s com WorkGet, stack/call/retn/switch e ABI de posição', id => {
    const world = createAmxWorld(id === 'zone:0223:entities' ? 0 : 1);
    world.vars[16514] = 3;
    world.actors[7] = { ...actor };
    const initial = createAmxState(bundle, id, 1, world);
    const result = runAmx(bundle, initial);
    expect(result.status).toBe('completed');
    expect(result.world.actors[7]).toMatchObject({ x: id === 'zone:0223:entities' ? 8 : 16, y: 3, z: 14, direction: 0 });
    expect(initial.world.actors[7]).toEqual(actor);
    expect(result).toEqual(runAmx(bundle, initial));
  });

  it('executa móvel real da casa até textbox de 19 células e continua até key wait', () => {
    const initial = createAmxState(bundle, 'zone:0223:map', 8, createAmxWorld());
    let current = runAmx(bundle, initial);
    expect(current.awaiting).toMatchObject({ kind: 'native', effect: { name: 'SEPlay', channel: 'audio' } });
    current = runAmx(bundle, resumeAmx(current, { kind: 'native-result', value: 0 }));
    expect(current.awaiting).toMatchObject({ kind: 'native', effect: { name: 'TalkMdlMsg_Seq', channel: 'dialogue' } });
    expect(current.world.dialogue).toHaveLength(19);
    expect(current.world.dialogue?.slice(0, 5)).toEqual([25, 0, -1, 0, 0]);
    current = runAmx(bundle, resumeAmx(current, { kind: 'native-result', value: 0 }));
    expect(current.awaiting).toMatchObject({ kind: 'native', effect: { name: 'LastKeyWait' } });
    current = runAmx(bundle, resumeAmx(current, { kind: 'native-result', value: 0 }));
    expect(current.status).toBe('completed');
    expect(current.world.dialogue).toBeNull();
  });

  it('entra no laboratório real e preserva o pedido ACMD sem inventar sua ABI', () => {
    const world = createAmxWorld();
    world.actors[255] = { ...actor };
    world.actors[1] = { ...actor };
    const result = runAmx(bundle, createAmxState(bundle, 'zone:0227:map', 1, world));
    expect(result.status).toBe('await-input');
    expect(result.awaiting).toMatchObject({ kind: 'native', effect: { name: 'MdlAcmdInit', channel: 'movement', args: [1] } });
    expect(result.world.actors[255]).toMatchObject({ x: 14, y: 2, z: 22 });
    expect(result.world.actors[1]).toMatchObject({ x: 14, y: 2, z: 20 });
  });

  it('segue GlobalCall real de Littleroot para script 9880, sem substituir o programa', () => {
    const world = createAmxWorld();
    const result = runAmx(bundle, createAmxState(bundle, 'zone:0006:map', 1, world));
    expect(result.status).toBe('await-input');
    expect(result.machines.at(-1)?.programId).toBe('global:0078');
    expect(result.machines).toHaveLength(2);
  });

  it.each([10581, 10582])('executa o global real de mãe/relógio %s até efeito pendente', scriptId => {
    const world = createAmxWorld(0, scriptId === 10582 ? 224 : 223);
    const result = runAmx(bundle, createAmxState(bundle, 'global:0047', scriptId, world));
    expect(result.status).toBe('await-input');
    expect(result.awaiting?.kind).toBe('native');
    expect(result.world.effects).toHaveLength(1);
  });

  it('executa o trigger real de Birch na Route 101 até registrar palavras do diálogo', () => {
    const result = runAmx(bundle, createAmxState(bundle, 'zone:0023:map', 8, createAmxWorld(0, 23)));
    expect(result.status).toBe('await-input');
    expect(result.awaiting).toMatchObject({ kind: 'native', effect: { channel: 'words', name: '_WordSetRegister' } });
  });

  it('classifica explicitamente todas as nativas diretas das quatro zonas e confere aridades reais', () => {
    for (const [id, entries] of Object.entries(opening.inventory)) {
      if (!/^zone:(0006|0223|0225|0227):/.test(id)) continue;
      for (const entry of entries) expect(getAmxNativeSignature(entry.name), `${id}/${entry.name}`).toMatchObject({ arity: entry.arity });
    }
  });

  it('preserva as aridades ROM do fluxo map/case 2 de Roxanne', () => {
    const rows = roxanne.programs.map.instructions;
    const nativeAt = (name: string, offset: number) => rows.find(row => row.offset === offset && row.native?.name === name);
    for (const offset of [204, 248, 280, 360, 448]) {
      expect(nativeAt('PokePartyGetParam', offset)?.argumentBytes).toBe(12);
    }
    expect(nativeAt('_CallTrainerBattleCore', 1892)?.argumentBytes).toBe(28);
    expect(nativeAt('BadgeGetFlag', 7280)?.argumentBytes).toBe(4);
    expect(nativeAt('BadgeSetFlag', 9188)?.argumentBytes).toBe(4);
    expect(nativeAt('GymSetVictoryInfo', 9204)?.argumentBytes).toBe(4);
    expect(getAmxNativeSignature('PokePartyGetParam')).toMatchObject({ arity: 3, channel: 'pokemon' });
    expect(getAmxNativeSignature('_CallTrainerBattleCore')).toMatchObject({ arity: 7, channel: 'pokemon' });
    expect(getAmxNativeSignature('BadgeGetFlag')).toMatchObject({ arity: 1, channel: 'pokemon' });
    expect(getAmxNativeSignature('BadgeSetFlag')).toMatchObject({ arity: 1, channel: 'pokemon' });
    expect(getAmxNativeSignature('GymSetVictoryInfo')).toMatchObject({ arity: 1, channel: 'pokemon' });
  });

  it('fixtures de memória correspondem aos hashes do disassembly versionado', () => {
    expect(memory['zone:0223:map'].sha256).toBe(zone223.programs.map.sha256);
    expect(memory['global:0078'].sha256).toBe(global78.sha256);
  });
});

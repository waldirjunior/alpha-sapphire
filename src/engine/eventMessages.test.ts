import { describe, expect, it, vi } from 'vitest';
import { EventMessageBanks } from './eventMessages';
import type { AmxEffect } from '../core/amxTypes';

const effect = (name: string, args: number[] = []): AmxEffect => ({ name, args, channel: 'ui' });
const talk = (custom: number) => effect('TalkMdlMsg_Seq', [0, ...Array<number>(16).fill(0), custom, 0]);

describe('ABI de bancos MsgLoad', () => {
  it('resolve seletor pelo CRO e escolhe StoryText/GameText, sem confundir seletor com arquivo', async () => {
    const load = vi.fn(async () => ['Auxiliar']);
    const banks = new EventMessageBanks(['Zona'], load);
    expect(await banks.request(effect('MsgLoad', [1, 0]))).toBe(0);
    expect(load).toHaveBeenCalledWith(true, 260);
    expect(banks.linesFor(talk(0))).toEqual(['Zona']);
    expect(banks.linesFor(talk(1))).toEqual(['Auxiliar']);
    expect(await banks.request(effect('MsgIsLoaded', [123]))).toBe(1);
    await banks.request(effect('MsgRelease'));
    await banks.request(effect('MsgLoad', [0, 1]));
    expect(load).toHaveBeenLastCalledWith(false, 23);
  });

  it('swap preserva os dois slots e release não destrói banco salvo', async () => {
    const load = vi.fn(async (_story: boolean, id: number) => [`Banco ${id}`]);
    const banks = new EventMessageBanks([], load);
    await banks.request(effect('MsgLoad', [1, 0]));
    await banks.request(effect('MsgSwap'));
    await banks.request(effect('MsgLoad', [0, 1]));
    expect(banks.linesFor(talk(1))).toEqual(['Banco 23']);
    await banks.request(effect('MsgRelease'));
    await banks.request(effect('MsgSwap'));
    expect(banks.linesFor(talk(1))).toEqual(['Banco 260']);
  });

  it('recusa seletor inválido, slot ausente e sobrescrita, sem sucesso implícito', async () => {
    const banks = new EventMessageBanks([], async () => ['Banco']);
    await expect(banks.request(effect('MsgLoad', [1, 17]))).rejects.toThrow('17');
    await expect(banks.request(effect('MsgIsLoaded'))).rejects.toThrow('MsgIsLoaded');
    expect(() => banks.linesFor(talk(1))).toThrow('banco auxiliar');
    await banks.request(effect('MsgLoad', [1, 0]));
    await expect(banks.request(effect('MsgLoad', [1, 1]))).rejects.toThrow('ocupado');
    expect(await banks.request(effect('SEPlay', [1]))).toBeUndefined();
  });
});

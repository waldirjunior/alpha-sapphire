import type { AmxEffect } from '../core/amxTypes';
import abi from '../data/zone_scripts/host-abi.json';
import { createStoryTextLoader } from './storyTextLoader';

const loadStoryText = createStoryTextLoader();
const gameBanks = import.meta.glob<readonly string[]>('../data/texts/gametext/*.json', { import: 'default' });

async function loadMessageBank(story: boolean, file: number): Promise<readonly string[]> {
  if (story) return loadStoryText(file);
  const load = gameBanks[`../data/texts/gametext/${String(file).padStart(4, '0')}.json`];
  if (!load) throw new Error(`MsgLoad: banco gametext/${file} não extraído`);
  return load();
}

export class EventMessageBanks {
  private loaded: readonly string[] | null = null;
  private saved: readonly string[] | null = null;

  constructor(private readonly zoneLines: readonly string[], private readonly load = loadMessageBank) {}

  linesFor(effect?: AmxEffect): readonly string[] {
    if (effect?.name !== 'TalkMdlMsg_Seq' || !effect.args[17]) return this.zoneLines;
    return this.loaded ?? this.missing('TalkMdlMsg_Seq: banco auxiliar');
  }

  async request(effect: AmxEffect): Promise<number | undefined> {
    const { name, args } = effect;
    if (name === 'MsgSwap') { [this.loaded, this.saved] = [this.saved, this.loaded]; return 0; }
    if (name === 'MsgIsLoaded') return this.loaded === null ? this.missing(name) : 1;
    if (name === 'MsgRelease') {
      if (this.loaded === null) this.missing(name);
      this.loaded = null;
      return 0;
    }
    if (name !== 'MsgLoad') return undefined;
    if (this.loaded !== null) throw new Error('MsgLoad: slot auxiliar ocupado; esperado MsgSwap/MsgRelease');
    const file = Number.isInteger(args[1]) ? abi.messageFiles[args[1]] : undefined;
    if (typeof file !== 'number') throw new Error(`MsgLoad: seletor ${args[1]} não suportado pelo CRO`);
    this.loaded = await this.load(args[0] !== 0, file);
    return 0;
  }

  private missing(name: string): never { throw new Error(`${name}: slot de mensagem não carregado`); }
}

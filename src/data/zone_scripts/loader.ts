import type { AmxBundle, AmxImage, AmxProgram } from '../../core/amxTypes';
import { createLocalAmxMemoryLoader, type MemoryImage } from './localMemory';
import localMemory from './local-memory.json';

interface ProgramSource extends AmxProgram { sha256: string }
interface Binding {
  kind: string; entityId: number | null; scriptId: number | null;
  matches: { program: string }[];
}
interface ZoneScripts { programs: Record<string, ProgramSource>; bindings: Binding[] }
interface MemorySource { images: Record<string, MemoryImage> }
const loadLocalMemory = createLocalAmxMemoryLoader();
export interface ZoneEventPrograms { bundle: AmxBundle; zone: ZoneScripts; zoneId: number }

const zones = import.meta.glob<ZoneScripts>('./[0-9][0-9][0-9][0-9].json', { import: 'default' });
const globals = import.meta.glob<ProgramSource>('./global_*.json', { import: 'default' });
let memoryPromise: Promise<MemorySource> | undefined;
const cache = new Map<number, Promise<ZoneEventPrograms | null>>();

function checkedImage(program: ProgramSource, memory: MemoryImage): AmxImage {
  if (program.sha256 !== memory.sha256) throw new Error(`Imagem AMX difere do disassembly ${program.sha256}`);
  return { program, data: memory.data, stackTop: memory.stackTop };
}

async function loadPrograms(zoneId: number): Promise<ZoneEventPrograms | null> {
  const key = String(zoneId).padStart(4, '0');
  const load = zones[`./${key}.json`];
  if (!load) return null;
  memoryPromise ??= import('./opening-memory.json').then(m => m.default).catch(error => {
    memoryPromise = undefined;
    throw error;
  });
  const [zone, memory] = await Promise.all([load(), memoryPromise]);
  const images: Record<string, MemoryImage> = { ...memory.images };
  await Promise.all(Object.entries(localMemory.images).filter(([id]) => id.startsWith(`zone:${key}:`) || id.startsWith('global:'))
    .map(async ([id, entry]) => { images[id] = await loadLocalMemory(entry.file, entry.sha256); }));
  const bundle: Record<string, AmxImage> = {};
  for (const [name, program] of Object.entries(zone.programs)) {
    const id = `zone:${key}:${name}`;
    if (images[id]) bundle[id] = checkedImage(program, images[id]);
  }
  await Promise.all(Object.entries(images).filter(([id]) => id.startsWith('global:')).map(async ([id, image]) => {
    const program = await globals[`./global_${id.slice(7)}.json`]();
    bundle[id] = checkedImage(program, image);
  }));
  return { zone, bundle, zoneId };
}

export function loadZoneEventPrograms(zoneId: number): Promise<ZoneEventPrograms | null> {
  const existing = cache.get(zoneId);
  if (existing) return existing;
  const pending = loadPrograms(zoneId).catch(error => { cache.delete(zoneId); throw error; });
  cache.set(zoneId, pending);
  return pending;
}

export function npcEventProgram(loaded: ZoneEventPrograms, actorId: number, scriptId: number): string | null {
  const binding = loaded.zone.bindings.find(row => row.kind === 'npcs' && row.entityId === actorId && row.scriptId === scriptId);
  if (!binding || binding.matches.length !== 1) return null;
  const name = binding.matches[0].program;
  const id = name.startsWith('global:') ? name : `zone:${String(loaded.zoneId).padStart(4, '0')}:${name}`;
  return loaded.bundle[id] ? id : null;
}

export function zoneInitProgram(loaded: ZoneEventPrograms): string | null {
  const id = `zone:${String(loaded.zoneId).padStart(4, '0')}:entities`;
  return loaded.bundle[id]?.program.dispatch?.cases.some(row => row.value === 1) ? id : null;
}

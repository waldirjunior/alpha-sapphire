import type { AmxBundle, AmxImage, AmxProgram } from '../../core/amxTypes';
import { createLocalAmxMemoryLoader, type MemoryImage } from './localMemory';
import localMemory from './local-memory.json';

interface ProgramDispatch extends NonNullable<AmxProgram['dispatch']> {
  tableOffset?: number;
  caseCalls?: Readonly<Record<string, readonly number[]>>;
}
interface ProgramSource extends Omit<AmxProgram, 'dispatch'> { sha256: string; dispatch: ProgramDispatch | null }
interface BindingMatch { program: string; target?: number; functions?: readonly number[]; tableOffset?: number }
interface Binding {
  kind: string; index?: number; entityId: number | null; scriptId: number | null; status?: string;
  matches: BindingMatch[];
}
interface ZoneScripts { entitySourceSha256: string; programs: Record<string, ProgramSource>; bindings: Binding[] }
interface MemorySource { images: Record<string, MemoryImage> }
const loadLocalMemory = createLocalAmxMemoryLoader();
export interface ZoneEventPrograms { bundle: AmxBundle; zone: ZoneScripts; zoneId: number }

const zones = import.meta.glob<ZoneScripts>('./[0-9][0-9][0-9][0-9].json', { import: 'default' });
const globals = import.meta.glob<ProgramSource>('./global_*.json', { import: 'default' });
let memoryPromise: Promise<MemorySource> | undefined;
const cache = new Map<number, Promise<ZoneEventPrograms | null>>();

const ROXANNE_BINDING = {
  zoneId: 441,
  entityId: 1,
  scriptId: 2,
  entitySourceSha256: '0d5908f71c51a9bbac17e39527dfadfb303a64dfd8f4befdd66e4c905373c72b',
  entities: { programSha256: 'ffc672f7a41aad0b49b7dae63cd86e40a8cb6c24f1b7f604ad8149eb4c228f57',
    tableOffset: 120, caseTarget: 60, functionTarget: 316 },
  program: 'map',
  programSha256: '73a0cdd51cfd40dd1c89b85362636ae66c364d6abb59cdbc25fb27f9935c0a02',
  map: { tableOffset: 6248, caseTarget: 6028, functionTarget: 7248 },
} as const;

function checkedImage(program: ProgramSource, memory: MemoryImage): AmxImage {
  if (program.sha256 !== memory.sha256) throw new Error(`Imagem AMX difere do disassembly ${program.sha256}`);
  return { program, data: memory.data, stackTop: memory.stackTop, publics: memory.publics };
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
  if (!binding) return null;
  const proven = provenAmbiguousProgram(loaded, binding, actorId, scriptId);
  const name = binding.matches.length === 1 ? binding.matches[0].program : proven;
  if (!name) return null;
  const id = name.startsWith('global:') ? name : `zone:${String(loaded.zoneId).padStart(4, '0')}:${name}`;
  return loaded.bundle[id] ? id : null;
}

function provenAmbiguousProgram(loaded: ZoneEventPrograms, binding: Binding, actorId: number, scriptId: number): string | null {
  const proof = ROXANNE_BINDING;
  if (loaded.zoneId !== proof.zoneId || actorId !== proof.entityId || scriptId !== proof.scriptId ||
      loaded.zone.entitySourceSha256 !== proof.entitySourceSha256 || binding.matches.length !== 2 ||
      !matchesCandidate(binding, 'entities', proof.entities) || !matchesCandidate(binding, proof.program, proof.map)) return null;
  const entities = loaded.zone.programs.entities;
  const map = loaded.zone.programs[proof.program];
  if (!matchesDispatch(entities, scriptId, proof.entities) || !matchesDispatch(map, scriptId, proof.map) ||
      entities.sha256 !== proof.entities.programSha256 || map.sha256 !== proof.programSha256) return null;
  return proof.program;
}

function matchesCandidate(binding: Binding, name: string, proof: { tableOffset: number; caseTarget: number; functionTarget: number }): boolean {
  return binding.matches.some(match => match.program === name && match.tableOffset === proof.tableOffset &&
    match.target === proof.caseTarget && match.functions?.includes(proof.functionTarget));
}

function matchesDispatch(program: ProgramSource, scriptId: number,
  proof: { tableOffset: number; caseTarget: number; functionTarget: number }): boolean {
  return program.dispatch?.tableOffset === proof.tableOffset &&
    program.dispatch.cases.find(row => row.value === scriptId)?.target === proof.caseTarget &&
    program.dispatch.caseCalls?.[String(scriptId)]?.includes(proof.functionTarget) === true;
}

export function zoneInitProgram(loaded: ZoneEventPrograms): string | null {
  const id = `zone:${String(loaded.zoneId).padStart(4, '0')}:entities`;
  return loaded.bundle[id]?.program.dispatch?.cases.some(row => row.value === 1) ? id : null;
}

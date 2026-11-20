import { describe, expect, it } from 'vitest';
import type { AmxImage, AmxProgram } from '../../core/amxTypes';
import { npcEventProgram, type ZoneEventPrograms } from './loader';

interface ProgramDispatch extends NonNullable<AmxProgram['dispatch']> {
  tableOffset: number;
  caseCalls: Readonly<Record<string, readonly number[]>>;
}
interface ProgramFixture extends Omit<AmxProgram, 'dispatch'> { sha256: string; dispatch: ProgramDispatch }

const entitiesProgram: ProgramFixture = {
  entryPoint: 4,
  instructions: [],
  dispatch: { selectorAddress: 0, tableOffset: 120, cases: [{ value: 2, target: 60 }], caseCalls: { '2': [316] } },
  sha256: 'ffc672f7a41aad0b49b7dae63cd86e40a8cb6c24f1b7f604ad8149eb4c228f57',
};
const mapProgram: ProgramFixture = {
  entryPoint: 5992,
  instructions: [],
  dispatch: { selectorAddress: 180, tableOffset: 6248, cases: [{ value: 2, target: 6028 }], caseCalls: { '2': [7248] } },
  sha256: '73a0cdd51cfd40dd1c89b85362636ae66c364d6abb59cdbc25fb27f9935c0a02',
};
const martEntitiesProgram: ProgramFixture = {
  entryPoint: 128,
  instructions: [],
  dispatch: { selectorAddress: 0, tableOffset: 244, cases: [{ value: 2, target: 184 }], caseCalls: { '2': [480] } },
  sha256: '4372f03eebfc732fd1c4b55664c8ecccdd29f699eec68f11b28fff898fb36f0b',
};
const martMapProgram: ProgramFixture = {
  entryPoint: 4116,
  instructions: [],
  dispatch: { selectorAddress: 132, tableOffset: 4252, cases: [{ value: 2, target: 4152 }], caseCalls: { '2': [4372] } },
  sha256: '16ce8441bb66362b509c9c0ab0625ef002dd328eabef5537216b50d93b6be65c',
};

function loadedZone(zoneId: number, entitySourceSha256: string, actorId: number, mapImage = mapProgram,
  entitiesImage = entitiesProgram): ZoneEventPrograms {
  const image = (program: ProgramFixture): AmxImage => ({ program, data: [], stackTop: 0 });
  return {
    zoneId,
    bundle: {
      [`zone:${String(zoneId).padStart(4, '0')}:map`]: image(mapImage),
      [`zone:${String(zoneId).padStart(4, '0')}:entities`]: image(entitiesImage),
    },
    zone: {
      entitySourceSha256,
      programs: { entities: entitiesImage, map: mapImage },
      bindings: [{ kind: 'npcs', index: actorId, entityId: actorId, scriptId: 2, status: 'ambiguous', matches: [
        { program: 'entities', target: entitiesImage.dispatch?.cases[0]?.target ?? 0,
          functions: entitiesImage.dispatch?.caseCalls?.['2'] ?? [], tableOffset: entitiesImage.dispatch?.tableOffset ?? 0 },
        { program: 'map', target: mapImage.dispatch?.cases[0]?.target ?? 0,
          functions: mapImage.dispatch?.caseCalls?.['2'] ?? [], tableOffset: mapImage.dispatch?.tableOffset ?? 0 },
      ] }],
    },
  };
}

describe('binding ROM do evento de Roxanne', () => {
  it('seleciona o map/case 2 de zone_0441 somente para a imagem e ZO provados', () => {
    const loaded = loadedZone(441, '0d5908f71c51a9bbac17e39527dfadfb303a64dfd8f4befdd66e4c905373c72b', 1);
    expect(npcEventProgram(loaded, 1, 2)).toBe('zone:0441:map');
  });

  it('não aplica a prova do ginásio à NPC6 do Poké Mart em zone_0285 nem a dados ROM divergentes', () => {
    const mart = loadedZone(285, '085857208600b45eb21ef16df04eb35f65dd2f978548c285bc54d90246b889bf', 6,
      martMapProgram, martEntitiesProgram);
    const changedGymImage = { ...mapProgram, sha256: '0'.repeat(64) };
    const changedGym = loadedZone(441, '0d5908f71c51a9bbac17e39527dfadfb303a64dfd8f4befdd66e4c905373c72b', 1, changedGymImage);
    const changedEntitySource = { ...entitiesProgram, sha256: '0'.repeat(64) };
    const changedEntity = loadedZone(441, '0d5908f71c51a9bbac17e39527dfadfb303a64dfd8f4befdd66e4c905373c72b',
      1, mapProgram, changedEntitySource);
    expect(npcEventProgram(mart, 6, 2)).toBeNull();
    expect(npcEventProgram(changedGym, 1, 2)).toBeNull();
    expect(npcEventProgram(changedEntity, 1, 2)).toBeNull();
  });
});

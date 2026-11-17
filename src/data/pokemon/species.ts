import { getMoveByName, getSpeciesById, type DexMove, type DexSpecies } from '../../core/dex';
import type { ElementalType } from '../../core/typeChart';

// Os dados vêm da ROM (src/data/battle/, A-010/A-011); aqui fica só o elenco com modelo .glb disponível.
export type PokemonType = ElementalType;

export const SPECIES = {
  treecko: getSpeciesById('treecko'),
  torchic: getSpeciesById('torchic'),
  mudkip: getSpeciesById('mudkip'),
  poochyena: getSpeciesById('poochyena'),
  zigzagoon: getSpeciesById('zigzagoon'),
  wurmple: getSpeciesById('wurmple'),
  lotad: getSpeciesById('lotad'),
  ralts: getSpeciesById('ralts'),
} satisfies Record<string, DexSpecies>;

export const MOVES = {
  pound: getMoveByName('pound'),
  absorb: getMoveByName('absorb'),
  scratch: getMoveByName('scratch'),
  ember: getMoveByName('ember'),
  tackle: getMoveByName('tackle'),
  water_gun: getMoveByName('water_gun'),
  bite: getMoveByName('bite'),
  bug_bite: getMoveByName('bug_bite'),
  confusion: getMoveByName('confusion'),
  disarming_voice: getMoveByName('disarming_voice'),
} satisfies Record<string, DexMove>;

const ROSTER: ReadonlyMap<string, DexSpecies> = new Map(Object.values(SPECIES).map((species) => [species.id, species]));

/** Espécies com modelo .glb extraído; ids vindos de mapas/encontros podem não estar no elenco. */
export function findRosterSpecies(id: string): DexSpecies | undefined {
  return ROSTER.get(id);
}

export function listRosterSpecies(): DexSpecies[] {
  return [...ROSTER.values()];
}

import { getMoveByName, getSpeciesById, type DexMove, type DexSpecies } from '../../core/dex';
import type { ElementalType } from '../../core/typeChart';
import nativeAssets from '../nativeAssets.json';

// Os dados vêm da ROM (src/data/battle/, A-010/A-011); aqui fica só o elenco com modelo .glb disponível.
export type PokemonType = ElementalType;

export const SPECIES = {
  get treecko(): DexSpecies {
    return getSpeciesById('treecko');
  },
  get torchic(): DexSpecies {
    return getSpeciesById('torchic');
  },
  get mudkip(): DexSpecies {
    return getSpeciesById('mudkip');
  },
  get poochyena(): DexSpecies {
    return getSpeciesById('poochyena');
  },
  get zigzagoon(): DexSpecies {
    return getSpeciesById('zigzagoon');
  },
  get wurmple(): DexSpecies {
    return getSpeciesById('wurmple');
  },
  get lotad(): DexSpecies {
    return getSpeciesById('lotad');
  },
  get ralts(): DexSpecies {
    return getSpeciesById('ralts');
  },
} satisfies Record<string, DexSpecies>;

export const MOVES = {
  get pound(): DexMove {
    return getMoveByName('pound');
  },
  get absorb(): DexMove {
    return getMoveByName('absorb');
  },
  get scratch(): DexMove {
    return getMoveByName('scratch');
  },
  get ember(): DexMove {
    return getMoveByName('ember');
  },
  get tackle(): DexMove {
    return getMoveByName('tackle');
  },
  get water_gun(): DexMove {
    return getMoveByName('water_gun');
  },
  get bite(): DexMove {
    return getMoveByName('bite');
  },
  get bug_bite(): DexMove {
    return getMoveByName('bug_bite');
  },
  get confusion(): DexMove {
    return getMoveByName('confusion');
  },
  get disarming_voice(): DexMove {
    return getMoveByName('disarming_voice');
  },
} satisfies Record<string, DexMove>;

// Getters: as tabelas da ROM são carregadas sob demanda (ADR-004), então nada é resolvido no import.
const ROSTER_IDS: readonly string[] = Object.keys(nativeAssets.pokemon);

/** Espécies com modelo .glb extraído; ids vindos de mapas/encontros podem não estar no elenco. */
export function findRosterSpecies(id: string): DexSpecies | undefined {
  return ROSTER_IDS.includes(id) ? getSpeciesById(id) : undefined;
}

export function listRosterSpecies(): DexSpecies[] {
  return ROSTER_IDS.map(getSpeciesById);
}

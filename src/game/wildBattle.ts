import { generatePokemon } from '../core/wildPokemon';
import type { DexSpecies } from '../core/dex';
import type { PokemonInstance } from '../core/battle';
import type { Rng } from '../core/statusConditions';

export function createWildBattlePokemon(species: DexSpecies, level: number, rng: Rng = Math.random): PokemonInstance {
  return generatePokemon(species, level, rng);
}

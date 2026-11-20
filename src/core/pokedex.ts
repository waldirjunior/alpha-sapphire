import type { PokemonInstance } from './battle';

export interface PokedexState {
  seenSpecies: readonly string[];
  caughtSpecies: readonly string[];
}

export function createPokedex(party: readonly PokemonInstance[]): PokedexState {
  const species = uniqueSpecies(party.map((pokemon) => pokemon.species.id));
  return { seenSpecies: species, caughtSpecies: species };
}

export function restorePokedex(seenSpecies: readonly string[], caughtSpecies: readonly string[]): PokedexState {
  const caught = uniqueSpecies(caughtSpecies);
  return { seenSpecies: uniqueSpecies([...seenSpecies, ...caught]), caughtSpecies: caught };
}

export function recordSeenSpecies(pokedex: PokedexState, speciesId: string): PokedexState {
  if (pokedex.seenSpecies.includes(speciesId)) return pokedex;
  return { ...pokedex, seenSpecies: [...pokedex.seenSpecies, speciesId] };
}

export function recordCaughtSpecies(pokedex: PokedexState, speciesId: string): PokedexState {
  if (pokedex.caughtSpecies.includes(speciesId) && pokedex.seenSpecies.includes(speciesId)) return pokedex;
  return {
    seenSpecies: uniqueSpecies([...pokedex.seenSpecies, speciesId]),
    caughtSpecies: uniqueSpecies([...pokedex.caughtSpecies, speciesId]),
  };
}

export function recordEvolution(pokedex: PokedexState, evolvedSpeciesId: string): PokedexState {
  return recordCaughtSpecies(pokedex, evolvedSpeciesId);
}

function uniqueSpecies(speciesIds: readonly string[]): string[] {
  return [...new Set(speciesIds)];
}

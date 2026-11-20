import type { Object3D } from 'three';
import pokemonBattleExpressions from '../data/pokemon_battle_expressions.json';
import { fixOrasMaterials } from './picaMaterials';
import {
  applyDefaultPokemonExpressions,
  bindPokemonBattleExpressions,
  type PokemonBattleExpressionController,
  type PokemonBattleExpressionProfile,
} from './pokemonModelExpressions';

const expressionProfiles: Readonly<Record<string, PokemonBattleExpressionProfile>> = pokemonBattleExpressions.pokemon;

export function preparePokemonBattleModel(model: Object3D, speciesId: string): PokemonBattleExpressionController | null {
  fixOrasMaterials(model, true);
  applyDefaultPokemonExpressions(model);
  const profile = expressionProfiles[speciesId];
  if (!profile) return null;
  const expressions = bindPokemonBattleExpressions(model, profile);
  expressions.update('idle', 0);
  return expressions;
}

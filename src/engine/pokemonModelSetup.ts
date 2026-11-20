import type { Object3D } from 'three';
import { fixOrasMaterials } from './picaMaterials';
import { applyDefaultPokemonExpressions } from './pokemonModelExpressions';

export function preparePokemonBattleModel(model: Object3D): void {
  fixOrasMaterials(model, true);
  applyDefaultPokemonExpressions(model);
}

import type { BattleMove, PokemonInstance } from './battlePokemon';
import type { DexStatChange } from './dex';
import { applyStageDelta, STAT_LABELS, statsForRomId } from './statStages';
import { rollInRange, type Rng } from './statusConditions';

export function inflictConfusion(target: PokemonInstance, move: BattleMove, rng: Rng): { target: PokemonInstance; message: string | null } {
  if (target.currentHp === 0 || target.ability === 'Own Tempo' || target.volatile.confusionTurns > 0) return { target, message: null };
  const turns = rollInRange(move.turnMin || 2, move.turnMax || 5, rng);
  return { target: { ...target, volatile: { ...target.volatile, confusionTurns: turns } }, message: `${target.species.name} ficou confuso!` };
}

export function applyStatChanges(
  pokemon: PokemonInstance,
  changes: readonly DexStatChange[],
  rng: Rng,
  guaranteed: boolean
): { pokemon: PokemonInstance; messages: string[] } {
  let current = pokemon;
  const messages: string[] = [];
  for (const change of changes) {
    if (!guaranteed && change.percent > 0 && rng() * 100 >= change.percent) continue;
    for (const stat of statsForRomId(change.stat)) {
      const { stages, applied } = applyStageDelta(current.stages, stat, change.stages);
      current = { ...current, stages };
      messages.push(stageMessage(current, STAT_LABELS[stat], applied, change.stages));
    }
  }
  return { pokemon: current, messages };
}

function stageMessage(pokemon: PokemonInstance, label: string, applied: number, requested: number): string {
  const name = pokemon.species.name;
  if (applied === 0) return `${label} de ${name} não pode ${requested > 0 ? 'subir' : 'cair'} mais!`;
  const size = Math.abs(applied) >= 2 ? ' muito' : '';
  return `${label} de ${name}${size} ${applied > 0 ? 'subiu' : 'caiu'}!`;
}

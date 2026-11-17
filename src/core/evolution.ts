import { fromTables } from './battleTables';
import { refreshStats, type PokemonInstance } from './battlePokemon';
import { getSpeciesByDex, type DexSpecies } from './dex';
import { learnLevelUpMoves } from './levelUp';

export type TimeOfDay = 'morning' | 'day' | 'night';

export interface EvolutionRule {
  method: string;
  argument: number;
  species: number;
  itemName?: string;
}

export interface EvolutionContext {
  timeOfDay: TimeOfDay;
  partyDexNumbers: readonly number[];
}

export interface EvolutionResult {
  pokemon: PokemonInstance;
  evolved: boolean;
  pendingMoves: number[];
  messages: string[];
}

const FRIENDSHIP_THRESHOLD = 220;
const PERSONALITY_SPLIT = 5;

const rulesByPersonal = fromTables(
  (tables) => new Map<number, readonly EvolutionRule[]>(tables.evolutions.map((entry) => [entry.personalIndex, entry.evolutions]))
);

export function getEvolutionRules(species: DexSpecies): readonly EvolutionRule[] {
  return rulesByPersonal().get(species.personalIndex) ?? [];
}

/** Faixas do relógio do 3DS usadas pela Gen VI: manhã 4–9h, dia 10–19h, noite 20–3h. */
export function timeOfDayFromHour(hour: number): TimeOfDay {
  if (hour >= 4 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 20) return 'day';
  return 'night';
}

function isDaytime(time: TimeOfDay): boolean {
  return time !== 'night';
}

function wurmpleBranch(pokemon: PokemonInstance): number {
  return (pokemon.personality >>> 16) % 10;
}

/**
 * Métodos de level-up suportados. Sexo, item segurado, local (Magnetic Field/Moss/Ice Rock),
 * afeição, clima, 3DS invertido, Beauty e Shedinja ainda não são simulados (P-010).
 */
function meetsLevelUpRule(pokemon: PokemonInstance, rule: EvolutionRule, context: EvolutionContext): boolean {
  const reached = pokemon.level >= rule.argument;
  switch (rule.method) {
    case 'level': return reached;
    case 'level_friendship': return pokemon.friendship >= FRIENDSHIP_THRESHOLD;
    case 'level_friendship_morning': return pokemon.friendship >= FRIENDSHIP_THRESHOLD && isDaytime(context.timeOfDay);
    case 'level_friendship_night': return pokemon.friendship >= FRIENDSHIP_THRESHOLD && !isDaytime(context.timeOfDay);
    case 'level_morning': return reached && isDaytime(context.timeOfDay);
    case 'level_night': return reached && !isDaytime(context.timeOfDay);
    case 'level_atk_gt_def': return reached && pokemon.attack > pokemon.defense;
    case 'level_atk_eq_def': return reached && pokemon.attack === pokemon.defense;
    case 'level_atk_lt_def': return reached && pokemon.attack < pokemon.defense;
    case 'level_personality_low': return reached && wurmpleBranch(pokemon) < PERSONALITY_SPLIT;
    case 'level_personality_high': return reached && wurmpleBranch(pokemon) >= PERSONALITY_SPLIT;
    case 'level_knows_move': return pokemon.moves.some((move) => move.id === rule.argument);
    case 'level_species_in_party': return context.partyDexNumbers.includes(rule.argument);
    default: return false;
  }
}

export function findLevelUpEvolution(pokemon: PokemonInstance, context: EvolutionContext): DexSpecies | null {
  const rule = getEvolutionRules(pokemon.species).find((candidate) => meetsLevelUpRule(pokemon, candidate, context));
  return rule ? getSpeciesByDex(rule.species) : null;
}

export function findItemEvolution(pokemon: PokemonInstance, itemName: string): DexSpecies | null {
  const rule = getEvolutionRules(pokemon.species).find((candidate) => candidate.method === 'use_item' && candidate.itemName === itemName);
  return rule ? getSpeciesByDex(rule.species) : null;
}

/** Troca de espécie mantendo slot de habilidade, golpes e dano; aprende os golpes do nível atual da nova espécie. */
export function evolvePokemon(pokemon: PokemonInstance, target: DexSpecies): EvolutionResult {
  const abilitySlot = Math.max(0, pokemon.species.abilities.indexOf(pokemon.ability));
  const evolved = refreshStats({ ...pokemon, species: target, ability: target.abilities[abilitySlot] ?? pokemon.ability });
  const learning = learnLevelUpMoves(evolved, [pokemon.level]);
  return {
    pokemon: learning.pokemon,
    evolved: true,
    pendingMoves: learning.pendingMoves,
    messages: [`${pokemon.species.name} evoluiu para ${target.name}!`, ...learning.messages],
  };
}

function unchanged(pokemon: PokemonInstance, messages: string[] = []): EvolutionResult {
  return { pokemon, evolved: false, pendingMoves: [], messages };
}

export function checkLevelUpEvolution(pokemon: PokemonInstance, context: EvolutionContext): EvolutionResult {
  const target = findLevelUpEvolution(pokemon, context);
  return target ? evolvePokemon(pokemon, target) : unchanged(pokemon);
}

export function useEvolutionItem(pokemon: PokemonInstance, itemName: string): EvolutionResult {
  const target = findItemEvolution(pokemon, itemName);
  return target ? evolvePokemon(pokemon, target) : unchanged(pokemon, ['Não teria nenhum efeito.']);
}

/** Evolui, ao fim da batalha, os membros que subiram de nível nela (Gen VI). */
export function evolveAfterBattle(
  party: readonly PokemonInstance[],
  leveledUp: readonly number[],
  timeOfDay: TimeOfDay
): { party: PokemonInstance[]; messages: string[] } {
  const context: EvolutionContext = { timeOfDay, partyDexNumbers: party.map((member) => member.species.dexNumber) };
  const messages: string[] = [];
  const next = party.map((member, idx) => {
    if (!leveledUp.includes(idx) || member.currentHp === 0) return member;
    const result = checkLevelUpEvolution(member, context);
    messages.push(...result.messages);
    return result.pokemon;
  });
  return { party: next, messages };
}

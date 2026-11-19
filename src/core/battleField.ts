import { getTypeEffectivenessAgainst, type ElementalType } from './typeChart';
import type { PokemonInstance } from './battlePokemon';
import { applyStageDelta } from './statStages';

export type BattleWeather = 'sun' | 'rain' | 'sandstorm' | 'hail';
export type BattleScreen = 'reflect' | 'lightScreen';
export type BattleFieldSide = 'player' | 'enemy';
export type EntryHazard = 'stealthRock' | 'spikes' | 'toxicSpikes' | 'stickyWeb';

export interface BattleHazards {
  stealthRock: boolean;
  spikes: number;
  toxicSpikes: number;
  stickyWeb: boolean;
}

const EMPTY_HAZARDS: BattleHazards = { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false };

export interface BattleWeatherState {
  kind: BattleWeather;
  turns: number;
}

export interface BattleScreenState {
  reflect: number;
  lightScreen: number;
}

export interface BattleFieldState {
  weather: BattleWeatherState | null;
  screens: Record<BattleFieldSide, BattleScreenState>;
  hazards: Record<BattleFieldSide, BattleHazards>;
}

export function createBattleField(weather?: BattleWeather): BattleFieldState {
  return {
    weather: weather ? { kind: weather, turns: 5 } : null,
    screens: { player: { reflect: 0, lightScreen: 0 }, enemy: { reflect: 0, lightScreen: 0 } },
    hazards: { player: { ...EMPTY_HAZARDS }, enemy: { ...EMPTY_HAZARDS } },
  };
}

export function setEntryHazard(field: BattleFieldState, side: BattleFieldSide, hazard: EntryHazard): { field: BattleFieldState; changed: boolean } {
  const current = field.hazards[side];
  if (hazard === 'spikes') return updateHazards(field, side, { spikes: Math.min(3, current.spikes + 1) }, current.spikes < 3);
  if (hazard === 'toxicSpikes') return updateHazards(field, side, { toxicSpikes: Math.min(2, current.toxicSpikes + 1) }, current.toxicSpikes < 2);
  if (current[hazard]) return { field, changed: false };
  const patch = hazard === 'stealthRock' ? { stealthRock: true } : { stickyWeb: true };
  return updateHazards(field, side, patch, true);
}

function updateHazards(field: BattleFieldState, side: BattleFieldSide, patch: Partial<BattleHazards>, changed: boolean) {
  if (!changed) return { field, changed };
  return { field: { ...field, hazards: { ...field.hazards, [side]: { ...field.hazards[side], ...patch } } }, changed };
}

export function clearEntryHazards(field: BattleFieldState, sides: readonly BattleFieldSide[]): BattleFieldState {
  const hazards = { ...field.hazards };
  for (const side of sides) hazards[side] = { ...EMPTY_HAZARDS };
  return { ...field, hazards };
}

export function applyEntryHazards(
  field: BattleFieldState,
  side: BattleFieldSide,
  pokemon: PokemonInstance
): { field: BattleFieldState; pokemon: PokemonInstance; messages: string[] } {
  const hazards = field.hazards[side];
  let entering = pokemon;
  let nextField = field;
  const messages: string[] = [];
  if (hazards.stealthRock) entering = applyStealthRock(entering, messages);
  if (entering.currentHp > 0 && hazards.spikes > 0 && isGrounded(entering)) entering = applySpikes(entering, hazards.spikes, messages);
  if (entering.currentHp > 0 && hazards.toxicSpikes > 0 && isPoisonType(entering) && isGrounded(entering)) {
    nextField = { ...nextField, hazards: { ...nextField.hazards, [side]: { ...nextField.hazards[side], toxicSpikes: 0 } } };
    messages.push(`${entering.species.name} absorveu as Toxic Spikes!`);
  } else if (entering.currentHp > 0 && hazards.toxicSpikes > 0 && isGrounded(entering) && !entering.status && !isPoisonType(entering) && !isSteelType(entering)) {
    const kind = hazards.toxicSpikes > 1 ? 'toxic' : 'poison';
    entering = { ...entering, status: { kind, counter: kind === 'toxic' ? 1 : 0 } };
    messages.push(`${entering.species.name} foi ${kind === 'toxic' ? 'gravemente envenenado' : 'envenenado'} pelas Toxic Spikes!`);
  }
  if (entering.currentHp > 0 && hazards.stickyWeb && isGrounded(entering)) entering = applyStickyWeb(entering, messages);
  return { field: nextField, pokemon: entering, messages };
}

function applyStealthRock(pokemon: PokemonInstance, messages: string[]): PokemonInstance {
  const effectiveness = getTypeEffectivenessAgainst('rock', pokemon.species.types);
  const damage = indirectDamage(pokemon, effectiveness, 8);
  if (damage === 0) return pokemon;
  messages.push(`${pokemon.species.name} sofreu ${damage} de dano das Stealth Rock.`);
  return { ...pokemon, currentHp: Math.max(0, pokemon.currentHp - damage) };
}

function applySpikes(pokemon: PokemonInstance, layers: number, messages: string[]): PokemonInstance {
  const denominator = layers === 1 ? 8 : layers === 2 ? 6 : 4;
  const damage = indirectDamage(pokemon, 1, denominator);
  messages.push(`${pokemon.species.name} sofreu ${damage} de dano das Spikes.`);
  return { ...pokemon, currentHp: Math.max(0, pokemon.currentHp - damage) };
}

function indirectDamage(pokemon: PokemonInstance, effectiveness: number, denominator: number): number {
  if (pokemon.ability === 'Magic Guard' || effectiveness === 0) return 0;
  return Math.max(1, Math.floor((pokemon.maxHp * effectiveness) / denominator));
}

function isGrounded(pokemon: PokemonInstance): boolean {
  return pokemon.ability !== 'Levitate' && !pokemon.species.types.includes('flying');
}

function isPoisonType(pokemon: PokemonInstance): boolean {
  return pokemon.species.types.includes('poison');
}

function isSteelType(pokemon: PokemonInstance): boolean {
  return pokemon.species.types.includes('steel');
}

function applyStickyWeb(pokemon: PokemonInstance, messages: string[]): PokemonInstance {
  const result = applyStageDelta(pokemon.stages, 'spe', -1);
  if (result.applied === 0) return pokemon;
  messages.push(`${pokemon.species.name} teve a Velocidade reduzida pelas Sticky Web!`);
  return { ...pokemon, stages: result.stages };
}

export function weatherPowerMultiplier(type: ElementalType, weather: BattleWeather | null, suppressed: boolean): number {
  if (suppressed || !weather) return 1;
  if (weather === 'sun') return type === 'fire' ? 1.5 : type === 'water' ? 0.5 : 1;
  if (weather === 'rain') return type === 'water' ? 1.5 : type === 'fire' ? 0.5 : 1;
  return 1;
}

export function weatherChipDamage(pokemon: PokemonInstance, weather: BattleWeather | null, suppressed: boolean): number {
  if (!weather || suppressed || pokemon.ability === 'Magic Guard' || pokemon.ability === 'Overcoat') return 0;
  if (weather === 'sandstorm' && hasType(pokemon, ['rock', 'ground', 'steel'])) return 0;
  if (weather === 'hail' && pokemon.species.types.includes('ice')) return 0;
  return Math.max(1, Math.floor(pokemon.maxHp / 16));
}

function hasType(pokemon: PokemonInstance, types: readonly ElementalType[]): boolean {
  return pokemon.species.types.some((type) => types.includes(type));
}

export function rockSpecialDefenseMultiplier(pokemon: PokemonInstance, weather: BattleWeather | null, suppressed: boolean): number {
  return weather === 'sandstorm' && !suppressed && pokemon.species.types.includes('rock') ? 1.5 : 1;
}

export function screenDamageMultiplier(screen: BattleScreen | null, moveType: 'physical' | 'special' | 'status', critical: boolean): number {
  if (critical || !screen) return 1;
  if (screen === 'reflect' && moveType === 'physical') return 0.5;
  if (screen === 'lightScreen' && moveType === 'special') return 0.5;
  return 1;
}

export function advanceBattleField(field: BattleFieldState): { field: BattleFieldState; messages: string[] } {
  const weather = advanceWeather(field.weather);
  const screens = advanceScreens(field.screens);
  return {
    field: { weather: weather.state, screens: screens.state, hazards: field.hazards },
    messages: [...weather.messages, ...screens.messages],
  };
}

function advanceWeather(weather: BattleWeatherState | null): { state: BattleWeatherState | null; messages: string[] } {
  if (!weather) return { state: null, messages: [] };
  if (weather.turns > 1) return { state: { ...weather, turns: weather.turns - 1 }, messages: [] };
  return { state: null, messages: [`${weatherName(weather.kind)} acabou!`] };
}

function advanceScreens(screens: BattleFieldState['screens']): { state: BattleFieldState['screens']; messages: string[] } {
  const next = { player: ageScreen(screens.player), enemy: ageScreen(screens.enemy) };
  const messages = screenEndMessages(screens);
  return { state: next, messages };
}

function ageScreen(screen: BattleScreenState): BattleScreenState {
  return { reflect: Math.max(0, screen.reflect - 1), lightScreen: Math.max(0, screen.lightScreen - 1) };
}

function screenEndMessages(before: BattleFieldState['screens']): string[] {
  const messages: string[] = [];
  for (const side of ['player', 'enemy'] as const) {
    if (before[side].reflect === 1) messages.push('O Reflect acabou!');
    if (before[side].lightScreen === 1) messages.push('O Light Screen acabou!');
  }
  return messages;
}

function weatherName(weather: BattleWeather): string {
  if (weather === 'sun') return 'O sol forte';
  if (weather === 'rain') return 'A chuva';
  return weather === 'sandstorm' ? 'A tempestade de areia' : 'O granizo';
}

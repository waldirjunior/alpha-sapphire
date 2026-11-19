import type { ElementalType } from './typeChart';
import type { PokemonInstance } from './battlePokemon';

export type BattleWeather = 'sun' | 'rain' | 'sandstorm' | 'hail';
export type BattleScreen = 'reflect' | 'lightScreen';
export type BattleFieldSide = 'player' | 'enemy';

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
}

export function createBattleField(weather?: BattleWeather): BattleFieldState {
  return {
    weather: weather ? { kind: weather, turns: 5 } : null,
    screens: { player: { reflect: 0, lightScreen: 0 }, enemy: { reflect: 0, lightScreen: 0 } },
  };
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
    field: { weather: weather.state, screens: screens.state },
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

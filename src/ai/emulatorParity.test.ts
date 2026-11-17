import { describe, expect, it } from 'vitest';
import {
  calculateDamage,
  createPokemonInstance,
  getTypeEffectiveness,
  rollWildEncounter,
} from '../core/battle';
import { createInitialState, isTallGrass, movePlayer } from '../core/gameState';
import type { Direction } from '../core/types';
import { MAPS } from '../data/maps';
import { ROUTE_101_ENCOUNTERS } from '../data/pokemon/route101';
import { MOVES, SPECIES } from '../data/pokemon/species';
import littlerootTexts from '../data/texts/littleroot_town.json';
import oldaleTexts from '../data/texts/oldale_town.json';

describe('emulator parity suite (Alpha Sapphire Gen VI)', () => {
  it('matches Hoenn overworld route: Littleroot Town -> Route 101 -> Oldale Town', () => {
    let state = createInitialState('littleroot_town', MAPS);
    expect(state.player.pos).toEqual({ x: 20, z: 14 });

    const stepsToRoute101: Direction[] = Array(14).fill('up');
    for (const dir of stepsToRoute101) {
      state = movePlayer(state, dir, MAPS);
    }
    expect(state.player.mapId).toBe('route_101');
    expect(state.player.pos).toEqual({ x: 20, z: 38 });

    // Verifica que há grama alta real no caminho da Route 101
    expect(isTallGrass(MAPS.route_101, { x: 12, z: 25 })).toBe(true);

    // Posiciona na saída norte da Route 101 e cruza para Oldale Town
    state = {
      ...state,
      player: { ...state.player, pos: { x: 20, z: 1 } },
    };
    state = movePlayer(state, 'up', MAPS);
    expect(state.player.mapId).toBe('oldale_town');
    expect(state.player.pos).toEqual({ x: 20, z: 38 });

    // Posiciona na saída norte de Oldale Town e cruza para Route 103
    state = {
      ...state,
      player: { ...state.player, pos: { x: 20, z: 1 } },
    };
    state = movePlayer(state, 'up', MAPS);
    expect(state.player.mapId).toBe('route_103');
    expect(state.player.pos).toEqual({ x: 20, z: 38 });
  });

  it('matches Gen VI Lv.5 starter stats, type chart, and damage bounds', () => {
    const torchic = createPokemonInstance(SPECIES.torchic, 5);
    const treecko = createPokemonInstance(SPECIES.treecko, 5);
    const mudkip = createPokemonInstance(SPECIES.mudkip, 5);

    // Fórmula padrão Gen VI sem EVs/IVs (floor(2*Base*5/100)+5+10)
    expect(torchic.maxHp).toBe(19);
    expect(treecko.maxHp).toBe(19);
    expect(mudkip.maxHp).toBe(20);

    expect(getTypeEffectiveness('fire', ['bug'])).toBe(2);
    expect(getTypeEffectiveness('water', ['fire'])).toBe(2);
    expect(getTypeEffectiveness('grass', ['fire'])).toBe(0.5);

    const wurmple = createPokemonInstance(SPECIES.wurmple, 2);
    const minRoll = calculateDamage(torchic, wurmple, MOVES.ember, () => 0);
    const maxRoll = calculateDamage(torchic, wurmple, MOVES.ember, () => 1);
    expect(minRoll).toBeGreaterThanOrEqual(10);
    expect(maxRoll).toBeGreaterThanOrEqual(minRoll);

    const encounter = rollWildEncounter(ROUTE_101_ENCOUNTERS, () => 0.1, () => 0.2);
    expect(encounter?.speciesId).toBe('poochyena');
  });

  it('preserves canonical ROM slogans for Littleroot Town and Oldale Town', () => {
    expect(littlerootTexts.lines).toContain('Littleroot Town\n“A town that can’t be shaded any hue.”');
    expect(oldaleTexts.lines).toContain('Oldale Town\nWhere things start off scarce.');
  });
});

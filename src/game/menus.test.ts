import { describe, expect, it } from 'vitest';
import {
  bagPocketItems,
  formatPlayNavTime,
  menuTabPresentation,
  splitDialogueSpeaker,
  toggleMenuTab,
} from './menus';
import type { BagState } from '../core/bag';

describe('game menus', () => {
  it('toggles the selected lower-screen tab closed and opens a different tab', () => {
    expect(toggleMenuTab('party', 'party')).toBeNull();
    expect(toggleMenuTab('party', 'bag')).toBe('bag');
    expect(toggleMenuTab(null, 'pokedex')).toBe('pokedex');
  });

  it('provides labeled X-menu tiles for the touch screen', () => {
    expect(menuTabPresentation('bag')).toEqual({
      label: 'Mochila',
      icon: '▣',
      accessibleName: 'Abrir mochila',
    });
    expect(menuTabPresentation('time').label).toBe('Hora');
  });

  it('formats the local 3DS clock with a stable 24-hour display', () => {
    expect(formatPlayNavTime(new Date(2026, 0, 2, 8, 5))).toBe('08:05');
  });

  it('separates a speaker name from dialogue while preserving plain text', () => {
    expect(splitDialogueSpeaker('Enfermeira Joy: O Centro Pokémon está pronto.')).toEqual({
      speaker: 'Enfermeira Joy',
      text: 'O Centro Pokémon está pronto.',
    });
    expect(splitDialogueSpeaker('Are you off to catch Pokémon?')).toEqual({
      speaker: '',
      text: 'Are you off to catch Pokémon?',
    });
  });

  it('lists the active bag pocket and shows the PokéNav fallback for an empty key pocket', () => {
    const bag: BagState = { potions: 2, pokeballs: 4, keyItems: [] };
    expect(bagPocketItems(bag, 'items')).toEqual([
      { label: 'Potion', count: 2, desc: 'Restaura 20 HP de um Pokémon.' },
    ]);
    expect(bagPocketItems(bag, 'key')).toEqual([
      { label: 'PokéNav Plus', count: 1, desc: 'Equipado na tela inferior do 3DS.' },
    ]);
  });
});

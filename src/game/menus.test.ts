import { describe, expect, it } from 'vitest';
import { bagPocketItems, toggleMenuTab } from './menus';
import type { BagState } from '../core/bag';

describe('game menus', () => {
  it('toggles the selected lower-screen tab closed and opens a different tab', () => {
    expect(toggleMenuTab('party', 'party')).toBeNull();
    expect(toggleMenuTab('party', 'bag')).toBe('bag');
    expect(toggleMenuTab(null, 'pokedex')).toBe('pokedex');
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

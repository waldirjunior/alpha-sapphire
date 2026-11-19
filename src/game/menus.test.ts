import { describe, expect, it } from 'vitest';
import {
  bagPocketItems,
  formatPlayNavTime,
  menuTabFrom,
  menuTabPresentation,
  splitDialogueSpeaker,
  toggleMenuTab,
} from './menus';
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  audioMuteButtonLabel,
  loadAudioPreferences,
  normalizeAudioVolume,
  saveAudioPreferences,
  toggleAudioMuted,
  updateAudioVolume,
} from './audioPreferences';
import { bindAudioControls, type AudioControlsHost } from './audioControls';
import type { BagState } from '../core/bag';

class FakeAudioControl implements EventTarget {
  readonly listeners = new Map<string, () => void>();
  readonly attributes = new Map<string, string>();
  value = '';
  textContent: string | null = null;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (typeof listener === 'function') this.listeners.set(type, () => listener(new Event(type)));
  }
  removeEventListener(): void {}
  dispatchEvent(event: Event): boolean {
    this.listeners.get(event.type)?.();
    return true;
  }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
}

describe('game menus', () => {
  it('normalizes the PokéNav volume slider to an integer from 0 to 100', () => {
    expect(normalizeAudioVolume('75')).toBe(75);
    expect(normalizeAudioVolume('-4')).toBe(0);
    expect(normalizeAudioVolume('140')).toBe(100);
    expect(normalizeAudioVolume('invalid')).toBe(60);
  });

  it('loads and saves audio volume and mute preferences in local storage', () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
    };
    expect(loadAudioPreferences(storage)).toEqual({ volume: 60, muted: false });
    saveAudioPreferences(storage, { volume: 130, muted: true });
    expect(loadAudioPreferences(storage)).toEqual({ volume: 100, muted: true });
    entries.set(AUDIO_PREFERENCES_STORAGE_KEY, '{invalid');
    expect(loadAudioPreferences(storage)).toEqual({ volume: 60, muted: false });
  });

  it('updates volume and mute state while keeping the other preference', () => {
    const initial = { volume: 40, muted: false };
    expect(updateAudioVolume(initial, '80')).toEqual({ volume: 80, muted: false });
    expect(toggleAudioMuted(initial)).toEqual({ volume: 40, muted: true });
    expect(audioMuteButtonLabel(true)).toBe('Ativar áudio');
    expect(audioMuteButtonLabel(false)).toBe('Silenciar áudio');
  });

  it('binds the slider and mute button to persistent PokéNav preferences', () => {
    const slider = new FakeAudioControl();
    const output = { value: '' };
    const muteButton = new FakeAudioControl();
    let preferences = { volume: 60, muted: false };
    const host: AudioControlsHost = {
      audioVolumeSlider: slider,
      audioVolumeOutput: output,
      audioMuteButton: muteButton,
      getAudioPreferences: () => preferences,
      setAudioPreferences: (next) => { preferences = next; },
    };

    bindAudioControls(host);
    expect(slider.value).toBe('60');
    expect(output.value).toBe('60%');
    slider.value = '85';
    slider.dispatchEvent(new Event('input'));
    expect(preferences).toEqual({ volume: 85, muted: false });
    muteButton.dispatchEvent(new Event('click'));
    expect(preferences).toEqual({ volume: 85, muted: true });
    expect(muteButton.attributes.get('aria-pressed')).toBe('true');
  });

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
    expect(menuTabPresentation('map')).toEqual({
      label: 'Mapa',
      icon: '⌖',
      accessibleName: 'Abrir Mapa de Hoenn',
    });
    expect(menuTabFrom('map')).toBe('map');
    expect(menuTabFrom('party')).toBe('party');
    expect(menuTabFrom('save')).toBeNull();
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

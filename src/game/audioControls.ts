import {
  audioMuteButtonLabel,
  toggleAudioMuted,
  updateAudioVolume,
  type AudioPreferences,
} from './audioPreferences';

export interface AudioVolumeSlider {
  value: string;
  addEventListener(type: 'input', listener: () => void): void;
  setAttribute(name: string, value: string): void;
}

export interface AudioVolumeOutput {
  value: string;
}

export interface AudioMuteButton {
  textContent: string | null;
  addEventListener(type: 'click', listener: () => void): void;
  setAttribute(name: string, value: string): void;
}

export interface AudioControlsHost {
  audioVolumeSlider: AudioVolumeSlider | null;
  audioVolumeOutput: AudioVolumeOutput | null;
  audioMuteButton: AudioMuteButton | null;
  getAudioPreferences(): AudioPreferences;
  setAudioPreferences(preferences: AudioPreferences): void;
}

export function bindAudioControls(host: AudioControlsHost): void {
  const slider = host.audioVolumeSlider;
  slider?.addEventListener('input', () => {
    host.setAudioPreferences(updateAudioVolume(host.getAudioPreferences(), slider.value));
    syncAudioControls(host);
  });
  host.audioMuteButton?.addEventListener('click', () => {
    host.setAudioPreferences(toggleAudioMuted(host.getAudioPreferences()));
    syncAudioControls(host);
  });
  syncAudioControls(host);
}

function syncAudioControls(host: AudioControlsHost): void {
  const { volume, muted } = host.getAudioPreferences();
  if (host.audioVolumeSlider) {
    host.audioVolumeSlider.value = String(volume);
    host.audioVolumeSlider.setAttribute('aria-valuetext', `${volume}%`);
  }
  if (host.audioVolumeOutput) host.audioVolumeOutput.value = `${volume}%`;
  if (!host.audioMuteButton) return;
  const label = audioMuteButtonLabel(muted);
  host.audioMuteButton.textContent = label;
  host.audioMuteButton.setAttribute('aria-label', label);
  host.audioMuteButton.setAttribute('aria-pressed', String(muted));
}

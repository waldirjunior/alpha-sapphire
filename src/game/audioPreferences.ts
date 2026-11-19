export interface AudioPreferences {
  volume: number;
  muted: boolean;
}

export const AUDIO_PREFERENCES_STORAGE_KEY = 'alpha-sapphire.audio-preferences';
const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = { volume: 60, muted: false };

export function normalizeAudioVolume(value: string): number {
  const volume = Number(value);
  if (!Number.isFinite(volume)) return DEFAULT_AUDIO_PREFERENCES.volume;
  return Math.round(Math.max(0, Math.min(100, volume)));
}

export function loadAudioPreferences(storage: Pick<Storage, 'getItem'>): AudioPreferences {
  const serialized = storage.getItem(AUDIO_PREFERENCES_STORAGE_KEY);
  if (!serialized) return { ...DEFAULT_AUDIO_PREFERENCES };
  try {
    const saved: unknown = JSON.parse(serialized);
    if (!isAudioPreferenceRecord(saved)) return { ...DEFAULT_AUDIO_PREFERENCES };
    return {
      volume: typeof saved.volume === 'number' ? normalizeAudioVolume(String(saved.volume)) : DEFAULT_AUDIO_PREFERENCES.volume,
      muted: typeof saved.muted === 'boolean' ? saved.muted : DEFAULT_AUDIO_PREFERENCES.muted,
    };
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }
}

export function saveAudioPreferences(storage: Pick<Storage, 'setItem'>, preferences: AudioPreferences): void {
  const normalized = { volume: normalizeAudioVolume(String(preferences.volume)), muted: preferences.muted };
  storage.setItem(AUDIO_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
}

export function updateAudioVolume(preferences: AudioPreferences, value: string): AudioPreferences {
  return { ...preferences, volume: normalizeAudioVolume(value) };
}

export function toggleAudioMuted(preferences: AudioPreferences): AudioPreferences {
  return { ...preferences, muted: !preferences.muted };
}

export function audioMuteButtonLabel(muted: boolean): string {
  return muted ? 'Ativar áudio' : 'Silenciar áudio';
}

function isAudioPreferenceRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ZoneAudioEntry {
  zone: number;
  bgmName: string | null;
  hasMp3: boolean;
}

/** mapId do jogo → zona ORAS → nome da faixa; `null` = silêncio (mapa sem zona conhecida ou sem mp3). */
export function resolveMapBgm(
  mapId: string,
  mapZones: Readonly<Record<string, number>>,
  zoneAudio: readonly ZoneAudioEntry[]
): string | null {
  const zone = mapZones[mapId];
  if (zone === undefined) return null;
  const entry = zoneAudio.find((candidate) => candidate.zone === zone);
  return entry?.hasMp3 && entry.bgmName ? entry.bgmName : null;
}

export function bgmUrl(baseUrl: string, bgmName: string): string {
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}assets/audio/${bgmName}.mp3`;
}

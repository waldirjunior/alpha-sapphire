import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BgmPlayer } from './audioPlayer';

class FakeParam {
  value = 1;
  readonly calls: string[] = [];
  setValueAtTime(value: number): void { this.value = value; this.calls.push(`set:${value}`); }
  linearRampToValueAtTime(value: number): void { this.calls.push(`ramp:${value}`); }
  setTargetAtTime(value: number): void { this.calls.push(`target:${value}`); }
  cancelScheduledValues(): void { this.calls.push('cancel'); }
}

class FakeGain {
  readonly gain = new FakeParam();
  connect(): void {}
}

class FakeSource {
  buffer: unknown = null;
  loop = false;
  started = false;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  connect(): void {}
  start(): void { this.started = true; }
  stop(when: number): void { this.stoppedAt = when; }
}

class FakeOscillator extends FakeSource {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeParam();
}

class FakeContext {
  static last: FakeContext;
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 10;
  readonly destination = {};
  readonly sources: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  readonly oscillators: FakeOscillator[] = [];
  constructor() { FakeContext.last = this; }
  async resume(): Promise<void> { this.state = 'running'; }
  createGain(): FakeGain { const gain = new FakeGain(); this.gains.push(gain); return gain; }
  createBufferSource(): FakeSource { const source = new FakeSource(); this.sources.push(source); return source; }
  createOscillator(): FakeOscillator { const oscillator = new FakeOscillator(); this.oscillators.push(oscillator); return oscillator; }
  async decodeAudioData(bytes: ArrayBuffer): Promise<{ bytes: number }> { return { bytes: bytes.byteLength }; }
}

function stubFetch(status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({ ok: status < 400, status, arrayBuffer: async () => new ArrayBuffer(8) }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('BgmPlayer', () => {
  beforeEach(() => { vi.stubGlobal('AudioContext', FakeContext); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('holds the requested track until a user gesture unlocks audio', async () => {
    stubFetch();
    const player = new BgmPlayer();
    await player.play('/audio/town.mp3');
    expect(player.currentUrl).toBeNull();
    await player.unlock();
    expect(player.currentUrl).toBe('/audio/town.mp3');
    expect(FakeContext.last.sources[0]).toMatchObject({ started: true, loop: true });
  });

  it('unlocks once on the first keydown or pointerdown', async () => {
    stubFetch();
    const player = new BgmPlayer();
    const target = new EventTarget();
    player.attachUnlock(target);
    await player.play('/audio/town.mp3');
    target.dispatchEvent(new Event('pointerdown'));
    await vi.waitFor(() => expect(player.currentUrl).toBe('/audio/town.mp3'));
    target.dispatchEvent(new Event('keydown'));
    expect(FakeContext.last.sources).toHaveLength(1);
  });

  it('does not restart the track that is already playing', async () => {
    const fetchMock = stubFetch();
    const player = new BgmPlayer();
    await player.unlock();
    await player.play('/audio/town.mp3');
    await player.play('/audio/town.mp3');
    expect(FakeContext.last.sources).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fades the previous track out when the zone changes', async () => {
    stubFetch();
    const player = new BgmPlayer(0.5);
    await player.unlock();
    await player.play('/audio/town.mp3');
    await player.play('/audio/route.mp3');
    const [town, route] = FakeContext.last.sources;
    expect(town.stoppedAt).toBe(10.5);
    expect(route.started).toBe(true);
    expect(player.currentUrl).toBe('/audio/route.mp3');
  });

  it('keeps only the latest request when tracks are asked in a burst', async () => {
    stubFetch();
    const player = new BgmPlayer();
    await player.unlock();
    await Promise.all([player.play('/audio/a.mp3'), player.play('/audio/b.mp3')]);
    expect(player.currentUrl).toBe('/audio/b.mp3');
    expect(FakeContext.last.sources).toHaveLength(1);
  });

  it('stops and forgets the pending request', async () => {
    stubFetch();
    const player = new BgmPlayer();
    await player.unlock();
    await player.play('/audio/town.mp3');
    player.stop();
    expect(player.currentUrl).toBeNull();
    await player.unlock();
    expect(FakeContext.last.sources).toHaveLength(1);
  });

  it('names the track and status when the file is missing, and retries later', async () => {
    const fetchMock = stubFetch(404);
    const player = new BgmPlayer();
    await player.unlock();
    await expect(player.loadTrack('/audio/missing.mp3')).rejects.toThrow('Faixa BGM indisponível: /audio/missing.mp3 (HTTP 404).');
    await expect(player.loadTrack('/audio/missing.mp3')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ducks the zone music under a jingle and restores it afterwards', async () => {
    stubFetch();
    const player = new BgmPlayer();
    await player.unlock();
    await player.play('/audio/town.mp3');
    await player.playJingle('/audio/heal.mp3');
    const trackGain = FakeContext.last.gains[1].gain;
    expect(trackGain.calls).toContain('target:0.15');
    FakeContext.last.sources[1].onended?.();
    expect(trackGain.calls.at(-1)).toBe('target:1');
  });

  it('ignores jingles while audio is still locked', async () => {
    const fetchMock = stubFetch();
    await new BgmPlayer().playJingle('/audio/heal.mp3');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clamps the master volume to the 0–1 range', async () => {
    stubFetch();
    const player = new BgmPlayer();
    await player.unlock();
    player.setVolume(7);
    expect(FakeContext.last.gains[0].gain.value).toBe(1);
    player.setVolume(-3);
    expect(FakeContext.last.gains[0].gain.value).toBe(0);
  });

  it('mutes and unmutes the master while preserving the selected volume', async () => {
    stubFetch();
    const player = new BgmPlayer();
    player.setVolume(0.72);
    player.setMuted(true);
    await player.unlock();
    expect(FakeContext.last.gains[0].gain.value).toBe(0);
    player.setMuted(false);
    expect(FakeContext.last.gains[0].gain.value).toBe(0.72);
  });

  it('synthesizes a sound cue on the unlocked WebAudio context without loading a file', async () => {
    const fetchMock = stubFetch();
    const player = new BgmPlayer();
    await player.unlock();
    expect(player.playSfx('menu-open')).toBeUndefined();
    expect(FakeContext.last.oscillators).toHaveLength(1);
    expect(FakeContext.last.oscillators[0]).toMatchObject({ type: 'square', started: true });
    expect(FakeContext.last.oscillators[0]?.stoppedAt).toBeGreaterThan(FakeContext.last.currentTime);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('plays an explicitly identified BCSAR asset when available', async () => {
    const fetchMock = stubFetch();
    const player = new BgmPlayer();
    await player.unlock();
    player.playSfx('dialogue-confirm', {
      index: 261,
      label: 'SEQ_SE_MESSAGE',
      url: '/assets/audio/sfx/message-sample.wav',
    });

    await vi.waitFor(() => expect(FakeContext.last.sources).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith('/assets/audio/sfx/message-sample.wav');
    expect(FakeContext.last.sources[0]).toMatchObject({ started: true, buffer: { bytes: 8 } });
    expect(FakeContext.last.oscillators).toHaveLength(0);
  });

  it('loads the labeled door-close sample through its domain cue', async () => {
    const fetchMock = stubFetch();
    const player = new BgmPlayer();
    await player.unlock();
    player.playSfx('door-close', {
      index: 1480,
      label: 'SEQ_SE_KW_DOORCLOSE',
    });

    await vi.waitFor(() => expect(FakeContext.last.sources).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith('/assets/audio/sfx/bcsar_1480_SEQ_SE_KW_DOORCLOSE.wav');
    expect(FakeContext.last.sources[0]).toMatchObject({ started: true, buffer: { bytes: 8 } });
  });

  it('falls back to the procedural cue when the BCSAR asset is unavailable', async () => {
    const fetchMock = stubFetch(404);
    const player = new BgmPlayer();
    await player.unlock();
    player.playSfx('menu-select', {
      index: 265,
      label: 'SEQ_SE_SELECT1',
    });

    await vi.waitFor(() => expect(FakeContext.last.oscillators).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith('/assets/audio/sfx/bcsar_265_SEQ_SE_SELECT1.wav');
    expect(FakeContext.last.oscillators[0]).toMatchObject({ type: 'square', started: true });
  });

  it('falls back when the asset request succeeds but the WAV cannot be decoded', async () => {
    stubFetch(200);
    const player = new BgmPlayer();
    await player.unlock();
    vi.spyOn(FakeContext.last, 'decodeAudioData').mockRejectedValue(new Error('HTML em vez de WAV'));
    player.playSfx('wall-bump', { index: 413, label: 'SEQ_SE_FLD_WALL_HIT' });

    await vi.waitFor(() => expect(FakeContext.last.oscillators).toHaveLength(1));
    expect(FakeContext.last.oscillators[0]).toMatchObject({ type: 'triangle', started: true });
  });

  it('plays a native SEPlay sample directly without turning it into a procedural cue', async () => {
    const fetchMock = stubFetch();
    const player = new BgmPlayer();
    await player.unlock();
    player.playNativeSfx({ index: 669, label: 'SEQ_SE_FLD_210', url: '/assets/audio/sfx/field-210.wav' });

    await vi.waitFor(() => expect(FakeContext.last.sources).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith('/assets/audio/sfx/field-210.wav');
    expect(FakeContext.last.oscillators).toHaveLength(0);
  });

  it('keeps an unavailable native SEPlay sample silent', async () => {
    const fetchMock = stubFetch(404);
    const player = new BgmPlayer();
    await player.unlock();
    player.playNativeSfx({ index: 669, label: 'SEQ_SE_FLD_210', url: '/assets/audio/sfx/missing.wav' });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(FakeContext.last.sources).toHaveLength(0);
    expect(FakeContext.last.oscillators).toHaveLength(0);
  });

  it('does nothing for sound cues while muted, locked, or when WebAudio is unavailable', async () => {
    const player = new BgmPlayer();
    expect(() => player.playSfx('battle-hit')).not.toThrow();
    await player.unlock();
    player.setMuted(true);
    player.playSfx('battle-hit');
    expect(FakeContext.last.oscillators).toHaveLength(0);
    player.setMuted(false);
    player.setVolume(0);
    player.playSfx('battle-hit');
    expect(FakeContext.last.oscillators).toHaveLength(0);
    player.setVolume(1);
    FakeContext.last.state = 'suspended';
    player.playSfx('battle-hit');
    expect(FakeContext.last.oscillators).toHaveLength(0);

    vi.stubGlobal('AudioContext', undefined);
    expect(() => new BgmPlayer().playSfx('dialogue-confirm')).not.toThrow();
    await expect(new BgmPlayer().unlock()).resolves.toBeUndefined();
  });
});

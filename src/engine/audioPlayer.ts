// P-008: BGM por Web Audio. Navegadores só liberam o AudioContext após um gesto do usuário,
// então a faixa pedida antes disso fica pendente e começa no primeiro keydown/pointerdown.

const DEFAULT_VOLUME = 0.6;
const DEFAULT_FADE_SECONDS = 0.4;
const UNLOCK_EVENTS = ['keydown', 'pointerdown'] as const;
const JINGLE_DUCK_LEVEL = 0.15;

interface PlayingTrack {
  url: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class BgmPlayer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer>>();
  private current: PlayingTrack | null = null;
  private requestedUrl: string | null = null;
  private requestId = 0;
  private volume = DEFAULT_VOLUME;

  constructor(private readonly fadeSeconds = DEFAULT_FADE_SECONDS) {}

  attachUnlock(target: EventTarget): void {
    const unlock = (): void => {
      UNLOCK_EVENTS.forEach((event) => target.removeEventListener(event, unlock));
      void this.unlock();
    };
    UNLOCK_EVENTS.forEach((event) => target.addEventListener(event, unlock));
  }

  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === 'suspended') await context.resume();
    if (this.requestedUrl && this.current?.url !== this.requestedUrl) await this.play(this.requestedUrl);
  }

  loadTrack(url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const context = this.ensureContext();
    const loading = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Faixa BGM indisponível: ${url} (HTTP ${response.status}).`);
        return response.arrayBuffer();
      })
      .then((bytes) => context.decodeAudioData(bytes));
    loading.catch(() => this.buffers.delete(url));
    this.buffers.set(url, loading);
    return loading;
  }

  /** Troca de faixa com fade-out curto da anterior; a mesma faixa não reinicia. */
  async play(url: string, loop = true): Promise<void> {
    this.requestedUrl = url;
    if (this.current?.url === url) return;
    if (!this.context || this.context.state !== 'running') return;
    const request = ++this.requestId;
    const buffer = await this.loadTrack(url);
    if (request !== this.requestId || this.requestedUrl !== url) return;
    this.fadeOutCurrent();
    this.current = this.startTrack(url, buffer, loop);
  }

  /** Toca um jingle (ME) uma vez, abaixando a BGM atual até ele terminar. */
  async playJingle(url: string): Promise<void> {
    if (!this.context || this.context.state !== 'running') return;
    const buffer = await this.loadTrack(url);
    const context = this.context;
    const ducked = this.current;
    ducked?.gain.gain.setTargetAtTime(JINGLE_DUCK_LEVEL, context.currentTime, 0.05);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master ?? context.destination);
    source.onended = () => {
      if (this.current === ducked) ducked?.gain.gain.setTargetAtTime(1, context.currentTime, 0.1);
    };
    source.start();
  }

  /** URL da faixa em reprodução (diagnóstico/validação em browser). */
  get currentUrl(): string | null {
    return this.current?.url ?? null;
  }

  stop(): void {
    this.requestedUrl = null;
    this.requestId += 1;
    this.fadeOutCurrent();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master && this.context) this.master.gain.setValueAtTime(this.volume, this.context.currentTime);
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = this.volume;
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    return context;
  }

  private startTrack(url: string, buffer: AudioBuffer, loop: boolean): PlayingTrack {
    const context = this.ensureContext();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(1, context.currentTime + this.fadeSeconds);
    gain.connect(this.master ?? context.destination);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(gain);
    source.start();
    return { url, source, gain };
  }

  private fadeOutCurrent(): void {
    const track = this.current;
    const context = this.context;
    this.current = null;
    if (!track || !context) return;
    const now = context.currentTime;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(track.gain.gain.value, now);
    track.gain.gain.linearRampToValueAtTime(0, now + this.fadeSeconds);
    track.source.stop(now + this.fadeSeconds);
  }
}

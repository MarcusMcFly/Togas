import type { SettingsManager } from './SettingsManager';

/** Un sonido que está sonando (o programado). */
export interface PlayingSound {
  /** Instante (reloj del AudioContext) en que termina por sí solo. */
  readonly endsAt: number;
  /** Lo detiene con un fundido corto para evitar chasquidos. */
  stop(fadeSeconds?: number): void;
}

/**
 * Una "receta" construye un sonido conectado a `destination`.
 * El AudioManager no sabe si es un fichero o un sintetizador: eso lo decide cada juego.
 */
export type SoundRecipe = (ctx: AudioContext, destination: AudioNode) => PlayingSound;

export interface PlayOptions {
  /** Si se indica, el sonido anterior del mismo canal se corta (evita solapes). */
  channel?: string;
}

type AudioContextCtor = typeof AudioContext;

/**
 * Audio global: volumen, silencio, limitador anti-picos y desbloqueo tras la
 * primera interacción del usuario (los navegadores lo exigen).
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private suspendedByApp = false;
  private readonly active = new Set<PlayingSound>();
  private readonly channels = new Map<string, PlayingSound>();

  constructor(private readonly settings: SettingsManager) {
    settings.subscribe(() => this.applySettings());
  }

  get isAvailable(): boolean {
    return this.getCtor() !== null;
  }

  /** Crea o reanuda el AudioContext. Llamar desde un gesto del usuario (clic, tecla, toque). */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = this.getCtor();
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      // Limitador: ningún efecto, por "legendario" que sea, puede dar un pico de volumen peligroso.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      limiter.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.connect(limiter);
      this.applySettings();
    }
    if (this.ctx.state === 'suspended' && !this.suspendedByApp) {
      this.ctx.resume().catch(() => undefined);
    }
  }

  play(recipe: SoundRecipe, options: PlayOptions = {}): PlayingSound | null {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state === 'closed' || this.suspendedByApp) return null;
    if (this.settings.current.muted) return null;

    this.prune(ctx.currentTime);
    if (options.channel) this.channels.get(options.channel)?.stop(0.06);

    let sound: PlayingSound;
    try {
      sound = recipe(ctx, this.master);
    } catch (error) {
      console.warn('[audio] no se pudo reproducir un sonido', error);
      return null;
    }
    this.active.add(sound);
    if (options.channel) this.channels.set(options.channel, sound);
    return sound;
  }

  stopAll(): void {
    for (const sound of this.active) sound.stop(0.05);
    this.active.clear();
    this.channels.clear();
  }

  /** Congela el audio (pausa). */
  suspend(): void {
    this.suspendedByApp = true;
    this.ctx?.suspend().catch(() => undefined);
  }

  resume(): void {
    this.suspendedByApp = false;
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  private applySettings(): void {
    if (!this.ctx || !this.master) return;
    const { muted, volume } = this.settings.current;
    this.master.gain.setTargetAtTime(muted ? 0 : volume * 0.9, this.ctx.currentTime, 0.02);
    if (muted) this.stopAll();
  }

  private prune(now: number): void {
    for (const sound of this.active) if (sound.endsAt < now) this.active.delete(sound);
    for (const [channel, sound] of this.channels) if (sound.endsAt < now) this.channels.delete(channel);
  }

  private getCtor(): AudioContextCtor | null {
    const g = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
    return g.AudioContext ?? g.webkitAudioContext ?? null;
  }
}

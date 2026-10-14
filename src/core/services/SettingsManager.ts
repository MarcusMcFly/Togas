import { clamp } from '../utils/math';
import type { SaveScope } from './SaveManager';

export interface Settings {
  muted: boolean;
  /** Volumen de efectos, de 0 a 1. */
  volume: number;
  /** Desactiva sacudidas de cámara y efectos visuales intensos. */
  reducedMotion: boolean;
}

type Listener = (settings: Readonly<Settings>) => void;

function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/** Ajustes globales (comunes a todos los juegos), persistidos en el almacén. */
export class SettingsManager {
  private value: Settings;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly scope: SaveScope) {
    const defaults: Settings = { muted: false, volume: 0.8, reducedMotion: prefersReducedMotion() };
    const saved = scope.get<Partial<Settings>>('values', {});
    this.value = sanitize({ ...defaults, ...saved });
  }

  get current(): Readonly<Settings> {
    return this.value;
  }

  update(patch: Partial<Settings>): void {
    this.value = sanitize({ ...this.value, ...patch });
    this.scope.set('values', this.value);
    for (const listener of [...this.listeners]) listener(this.value);
  }

  /** Devuelve la función para darse de baja. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function sanitize(settings: Settings): Settings {
  return {
    muted: Boolean(settings.muted),
    volume: clamp(Number(settings.volume) || 0, 0, 1),
    reducedMotion: Boolean(settings.reducedMotion),
  };
}

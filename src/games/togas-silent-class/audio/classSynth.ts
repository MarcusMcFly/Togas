import { Biquad, curve, makeRandom, normalize, pulseTrain, saturate, smoothNoise } from '../../../core/audio/dsp';
import type { FartVoice } from '../../../core/characters/SkinDefinition';
import { renderFart } from '../../../core/characters/voiceSynth';
import type { TrumpetVariant } from '../config/scoring.config';

/**
 * Síntesis muestra a muestra de los sonidos propios del aula. Todo sale de la voz
 * de la skin (`FartVoice`), así cada personaje suena distinto sin lógica especial.
 */

type Curve = ReadonlyArray<readonly [number, number]>;

/** Pedo silencioso: un "fsss" casi inaudible con un aleteo mínimo. El pico es bajo a propósito. */
export function renderSilentFart(voice: FartVoice, tier: number, seed: number, sampleRate: number): Float32Array {
  const rand = makeRandom(seed);
  const duration = 0.45 + tier * 0.14 + rand() * 0.1;
  const n = Math.floor(duration * sampleRate);
  const hiss = new Biquad(sampleRate).bandpass(voice.resonance * 5.5, 1.4);
  const body = new Biquad(sampleRate).lowpass(voice.resonance * 1.4);
  const wobble = smoothNoise(rand, n, sampleRate, 6);
  const f0 = new Float32Array(n).fill(voice.basePitch * 0.55);
  for (let i = 0; i < n; i++) f0[i] *= 1 + wobble[i] * 0.2;
  const flutter = pulseTrain(rand, { sampleRate, f0, jitter: 0.1, shimmer: 0.4, openQuotient: 0.4, diplophonia: 0.2 });
  const env: Curve = [[0, 0], [0.12, 1], [0.7, 0.8], [1, 0]];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const e = curve(env, t);
    const noise = rand() * 2 - 1;
    out[i] = (hiss.process(noise) * (0.6 + voice.breathiness) + body.process(flutter[i]) * 0.25) * e * (1 + wobble[i] * 0.3);
  }
  return normalize(out, 0.3);
}

interface BrassShape {
  duration: number;
  /** Multiplicador del tono base a lo largo del tiempo. */
  pitch: Curve;
  amp: Curve;
  /** Profundidad del vibrato (0–1). */
  vibrato: number;
  /** Brillo máximo del metal (Hz del filtro). */
  brightness: number;
  growl: number;
}

const BRASS: Record<TrumpetVariant, BrassShape> = {
  short: { duration: 0.42, pitch: [[0, 0.9], [0.2, 1.05], [1, 0.95]], amp: [[0, 0], [0.06, 1], [0.7, 0.8], [1, 0]], vibrato: 0.01, brightness: 2600, growl: 0.1 },
  squeaky: {
    duration: 0.75, pitch: [[0, 2.6], [0.3, 3.2], [0.55, 2.4], [0.8, 3.4], [1, 2.2]], amp: [[0, 0], [0.05, 0.9], [0.5, 1], [0.9, 0.7], [1, 0]],
    vibrato: 0.05, brightness: 4200, growl: 0.05,
  },
  // "Wah wah wah waaaah": el trombón triste.
  trombone: {
    duration: 1.25,
    pitch: [[0, 1.5], [0.2, 1.5], [0.22, 1.41], [0.42, 1.41], [0.44, 1.33], [0.62, 1.33], [0.64, 1.26], [1, 1.12]],
    amp: [[0, 0], [0.03, 1], [0.19, 0.6], [0.23, 1], [0.41, 0.6], [0.45, 1], [0.61, 0.6], [0.65, 1], [0.92, 0.8], [1, 0]],
    vibrato: 0.035, brightness: 3000, growl: 0.2,
  },
  tuba: { duration: 1.35, pitch: [[0, 0.75], [0.15, 0.8], [0.7, 0.66], [1, 0.5]], amp: [[0, 0], [0.08, 1], [0.75, 0.9], [1, 0]], vibrato: 0.02, brightness: 1300, growl: 0.55 },
  // Fanfarria que sube… y se desinfla.
  finale: {
    duration: 2.1,
    pitch: [[0, 1], [0.12, 1], [0.13, 1.26], [0.25, 1.26], [0.26, 1.5], [0.38, 1.5], [0.39, 2], [0.7, 2], [0.85, 1.6], [1, 0.7]],
    amp: [[0, 0], [0.02, 0.8], [0.12, 0.6], [0.14, 0.85], [0.25, 0.6], [0.27, 0.9], [0.38, 0.6], [0.4, 1], [0.7, 1], [1, 0]],
    vibrato: 0.03, brightness: 3800, growl: 0.4,
  },
};

/** Duración (s) de cada variante de trompetazo, para sincronizar animaciones. */
export const TRUMPET_DURATION: Record<TrumpetVariant, number> = Object.fromEntries(
  Object.entries(BRASS).map(([k, v]) => [k, v.duration]),
) as Record<TrumpetVariant, number>;

/**
 * Pedo-trompeta: un instrumento de metal (tren de pulsos con filtro que se abre con
 * el volumen, como un metal real) mezclado con el pedo "de verdad" de la skin.
 */
export function renderTrumpetFart(voice: FartVoice, variant: TrumpetVariant, intensity: number, seed: number, sampleRate: number): Float32Array {
  const rand = makeRandom(seed);
  const shape = BRASS[variant];
  const n = Math.floor(shape.duration * sampleRate);
  // El tono del "instrumento" sale de la voz de la skin: Pollo suena más grave que Marcus.
  const base = voice.basePitch * 2.6 * (0.96 + rand() * 0.08);
  const vibrato = smoothNoise(rand, n, sampleRate, 5.5);
  const f0 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const vib = Math.sin((i / sampleRate) * Math.PI * 2 * 5.5) * shape.vibrato + vibrato[i] * shape.vibrato * 0.5;
    f0[i] = base * curve(shape.pitch, t) * (1 + vib);
  }
  const source = pulseTrain(rand, { sampleRate, f0, jitter: 0.01 + shape.growl * 0.04, shimmer: 0.05 + shape.growl * 0.2, openQuotient: 0.5, diplophonia: shape.growl * 0.5 });
  const bell = new Biquad(sampleRate);
  const formant = new Biquad(sampleRate).bandpass(1200, 2);
  const brass = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = curve(shape.amp, i / n);
    if (i % 32 === 0) bell.lowpass(300 + shape.brightness * a, 1.2);
    const s = source[i] * a;
    brass[i] = bell.process(s) + formant.process(s) * 0.25;
  }
  normalize(brass, 0.8);

  // Debajo, el pedo de la skin a la misma intensidad: la "textura" orgánica.
  const fart = renderFart(voice, Math.min(5, Math.max(1, intensity)), seed ^ 0x5f3759df, sampleRate);
  const out = new Float32Array(Math.max(n, fart.length));
  for (let i = 0; i < out.length; i++) out[i] = (brass[i] ?? 0) + (fart[i] ?? 0) * 0.7;
  saturate(out, 0.4 + intensity * 0.15);
  return normalize(out, 0.9);
}

/**
 * Piezas de síntesis "muestra a muestra" (sin Web Audio): se pueden probar en Node
 * y generar ficheros .wav. Todo es determinista a partir de una semilla.
 */

/** Generador pseudoaleatorio rápido (xorshift) en [0, 1). */
export function makeRandom(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Ruido suave: valores aleatorios en [-1, 1] unidos con interpolación a `rateHz`.
 * Sirve para derivas de tono, temblores y gorgoteos que no suenen a máquina.
 */
export function smoothNoise(rand: () => number, length: number, sampleRate: number, rateHz: number): Float32Array {
  const out = new Float32Array(length);
  const step = Math.max(1, Math.floor(sampleRate / rateHz));
  let a = rand() * 2 - 1;
  let b = rand() * 2 - 1;
  for (let i = 0; i < length; i++) {
    const k = i % step;
    if (k === 0 && i > 0) {
      a = b;
      b = rand() * 2 - 1;
    }
    const t = k / step;
    // Interpolación coseno: sin esquinas.
    const w = (1 - Math.cos(Math.PI * t)) / 2;
    out[i] = a + (b - a) * w;
  }
  return out;
}

/** Interpola una curva definida por puntos [tiempo 0–1, valor]. */
export function curve(points: ReadonlyArray<readonly [number, number]>, t: number): number {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      const x = (t - t0) / (t1 - t0 || 1);
      return v0 + (v1 - v0) * x;
    }
  }
  return points[points.length - 1][1];
}

export interface PulseOptions {
  sampleRate: number;
  /** Frecuencia fundamental en cada muestra (Hz). */
  f0: Float32Array;
  /** Variación aleatoria del periodo de cada pulso (0.05 = ±5 %). */
  jitter: number;
  /** Variación aleatoria de la amplitud de cada pulso. */
  shimmer: number;
  /** Parte del periodo en que la "válvula" está abierta (0–1). Menor = más áspero. */
  openQuotient: number;
  /** 0–1: alterna pulsos fuertes y débiles (voz rota, "creaky voice"). */
  diplophonia: number;
}

/**
 * Tren de pulsos irregular: modela tanto cuerdas vocales (eructo) como un esfínter
 * que aletea (pedo). Se usa la derivada del flujo, más rica en armónicos.
 */
export function pulseTrain(rand: () => number, options: PulseOptions): Float32Array {
  const { sampleRate, f0, jitter, shimmer, openQuotient, diplophonia } = options;
  const out = new Float32Array(f0.length);
  let phase = 0;
  let periodScale = 1;
  let amp = 1;
  let periodIndex = 0;
  let prev = 0;
  for (let i = 0; i < f0.length; i++) {
    phase += (f0[i] * periodScale) / sampleRate;
    if (phase >= 1) {
      phase -= 1;
      periodIndex++;
      periodScale = 1 + (rand() * 2 - 1) * jitter;
      amp = 1 + (rand() * 2 - 1) * shimmer;
      if (periodIndex % 2 === 0) amp *= 1 - diplophonia * 0.6;
    }
    const flow = phase < openQuotient ? Math.sin((Math.PI * phase) / openQuotient) ** 2 : 0;
    // La derivada por muestra encoge con tonos graves; se compensa para que la
    // amplitud del pulso no dependa del tono (pico ≈ 1).
    const scale = (sampleRate * openQuotient) / (Math.PI * Math.max(1, f0[i] * periodScale));
    out[i] = (flow - prev) * amp * scale;
    prev = flow;
  }
  return out;
}

/** Filtro biquad (RBJ) con estado, cuyos coeficientes pueden cambiar con el tiempo. */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(private readonly sampleRate: number) {}

  bandpass(frequency: number, q: number): this {
    const w = (2 * Math.PI * Math.min(frequency, this.sampleRate * 0.45)) / this.sampleRate;
    const alpha = Math.sin(w) / (2 * q);
    return this.set(alpha, 0, -alpha, 1 + alpha, -2 * Math.cos(w), 1 - alpha);
  }

  lowpass(frequency: number, q = Math.SQRT1_2): this {
    const w = (2 * Math.PI * Math.min(frequency, this.sampleRate * 0.45)) / this.sampleRate;
    const alpha = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    return this.set((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + alpha, -2 * c, 1 - alpha);
  }

  highpass(frequency: number, q = Math.SQRT1_2): this {
    const w = (2 * Math.PI * Math.min(frequency, this.sampleRate * 0.45)) / this.sampleRate;
    const alpha = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    return this.set((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + alpha, -2 * c, 1 - alpha);
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }

  private set(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): this {
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
    return this;
  }
}

/** Escala la señal para que su pico sea `peak` (y quita cualquier valor no finito). */
export function normalize(samples: Float32Array, peak: number): Float32Array {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (!Number.isFinite(v)) samples[i] = 0;
    else if (Math.abs(v) > max) max = Math.abs(v);
  }
  if (max > 0) {
    const k = peak / max;
    for (let i = 0; i < samples.length; i++) samples[i] *= k;
  }
  return samples;
}

/** Saturación suave (tanh): engorda el sonido sin subir el pico. */
export function saturate(samples: Float32Array, drive: number): Float32Array {
  if (drive <= 0) return samples;
  const k = 1 + drive;
  const norm = Math.tanh(k);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.tanh(samples[i] * k) / norm;
  return samples;
}

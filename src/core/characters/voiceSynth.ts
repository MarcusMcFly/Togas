import { Biquad, curve, makeRandom, normalize, pulseTrain, saturate, smoothNoise } from '../audio/dsp';
import type { BurpVoice, FartVoice } from './SkinDefinition';

/**
 * Síntesis física (simplificada) de eructos y pedos, muestra a muestra.
 * No usa Web Audio: devuelve las muestras, así se puede probar en Node y exportar a .wav.
 *
 * - Eructo: cuerdas vocales vibrando muy grave e irregulares (voz rota al empezar y
 *   al terminar), filtradas por la boca, que pasa de "o" a "aaa" y a "u". Más gorgoteo.
 * - Pedo: una "válvula" que aletea a trompicones (varios tramos), resonancia del cuerpo,
 *   chasquidos húmedos, escape de aire y, en niveles altos, un pitido final.
 *
 * El nivel (1–5) alarga, agrava y "engorda" el sonido; el volumen lo controla quien reproduce.
 */

const UPDATE_EVERY = 32; // muestras entre recálculos de filtros variables

export function renderBurp(voice: BurpVoice, tier: number, seed: number, sampleRate: number): Float32Array {
  const rand = makeRandom(seed);
  const range = (a: number, b: number) => a + (b - a) * rand();
  const power = (tier - 1) / 4; // 0 en nivel 1, 1 en nivel 5
  const duration = 0.32 + tier * 0.2 + range(0, 0.1);
  const n = Math.floor(duration * sampleRate);

  // Tono: arranca en voz rota (muy grave), sube, ondula y vuelve a romperse al final.
  const base = voice.basePitch * (1 - power * 0.18) * range(0.94, 1.06);
  const shape: ReadonlyArray<readonly [number, number]> = tier >= 4
    ? [[0, 0.5], [0.07, 1.15], [0.28, 1], [0.5, 1.12], [0.74, 0.92], [0.9, 0.6], [1, 0.42]]
    : [[0, 0.55], [0.1, 1.1], [0.45, 1], [0.8, 0.85], [0.92, 0.6], [1, 0.45]];
  const drift = smoothNoise(rand, n, sampleRate, 3);
  const tremor = smoothNoise(rand, n, sampleRate, 9 + tier);
  const f0 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    f0[i] = base * curve(shape, i / n) * (1 + drift[i] * 0.06 + tremor[i] * (0.03 + voice.roughness * 0.05));
  }
  const source = pulseTrain(rand, {
    sampleRate,
    f0,
    jitter: 0.03 + voice.roughness * 0.1,
    shimmer: 0.15 + voice.roughness * 0.3,
    openQuotient: 0.55,
    diplophonia: voice.roughness,
  });

  // Gorgoteo: ruido de garganta modulado por "burbujas".
  const bubbles = smoothNoise(rand, n, sampleRate, 16);
  const gurgleFilter = new Biquad(sampleRate).bandpass(360, 1.5);

  // Boca: la vocal se abre ("o" → "aaa") y se cierra ("u").
  const open = 1 + power * 0.1;
  const f1Shape: ReadonlyArray<readonly [number, number]> = [[0, 0.75], [0.25, 1.15 * open], [0.7, 1.05 * open], [1, 0.7]];
  const f2Shape: ReadonlyArray<readonly [number, number]> = [[0, 0.8], [0.25, 1.1 * open], [0.7, 1], [1, 0.65]];
  const formant1 = new Biquad(sampleRate);
  const formant2 = new Biquad(sampleRate);
  const formant3 = new Biquad(sampleRate).bandpass(2400, 6);
  const chest = new Biquad(sampleRate).lowpass(280);

  const ampShape: ReadonlyArray<readonly [number, number]> = [[0, 0], [0.02, 1], [0.5, 0.95 + power * 0.1], [0.85, 0.8], [1, 0]];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    if (i % UPDATE_EVERY === 0) {
      formant1.bandpass(voice.formants[0] * curve(f1Shape, t), 4);
      formant2.bandpass(voice.formants[1] * curve(f2Shape, t), 5);
    }
    const s = source[i];
    const bubble = Math.max(0, bubbles[i]) ** 2 * voice.gurgle;
    const gurgle = gurgleFilter.process((rand() * 2 - 1) * bubble) * 0.6;
    const voiced = formant1.process(s) * 1.6 + formant2.process(s) * 0.8 + formant3.process(s) * 0.15 + chest.process(s) * 0.12;
    const wobble = tier >= 4 ? 1 + tremor[i] * 0.15 : 1;
    out[i] = (voiced + gurgle) * curve(ampShape, t) * wobble;
  }

  normalize(out, 0.9);
  // Golpe de glotis al arrancar: el "¡b!" de "BURP" (después de normalizar, para que no mande él).
  const click = Math.floor(sampleRate * 0.004);
  for (let i = 0; i < click && i < n; i++) out[i] += (1 - i / click) * 0.25 * (rand() * 2 - 1);
  saturate(out, power * 1.2);
  return normalize(out, 0.9);
}

interface Segment {
  start: number;
  end: number;
  pitch: number;
  amp: number;
}

export function renderFart(voice: FartVoice, tier: number, seed: number, sampleRate: number): Float32Array {
  const rand = makeRandom(seed);
  const range = (a: number, b: number) => a + (b - a) * rand();
  const power = (tier - 1) / 4;
  const duration = 0.32 + tier * 0.28 + range(0, 0.15);
  const tail = tier >= 2 ? 0.22 : 0.08;
  const n = Math.floor((duration + tail) * sampleRate);
  const bodyEnd = Math.floor(duration * sampleRate);

  // Tramos con parones: "prrt… prt… PRRRRRRT". El último es el más largo.
  const segmentCount = tier === 1 ? 1 : 1 + Math.floor(rand() * Math.min(tier, 4));
  const weights = Array.from({ length: segmentCount }, (_, i) => (i === segmentCount - 1 ? 2.2 : range(0.5, 1.1)));
  const gaps = Array.from({ length: segmentCount - 1 }, () => range(0.03, 0.08) * sampleRate);
  const gapTotal = gaps.reduce((a, b) => a + b, 0);
  const weightTotal = weights.reduce((a, b) => a + b, 0);
  const segments: Segment[] = [];
  let cursor = 0;
  weights.forEach((w, i) => {
    const length = ((bodyEnd - gapTotal) * w) / weightTotal;
    const last = i === segmentCount - 1;
    segments.push({ start: cursor, end: cursor + length, pitch: last ? 1 : range(0.8, 1.25), amp: last ? 1 : range(0.65, 0.95) });
    cursor += length + (gaps[i] ?? 0);
  });

  const squeak = tier >= 3 && rand() < 0.75;
  const base = voice.basePitch * (1 - power * 0.2) * range(0.92, 1.08);
  const flap = smoothNoise(rand, n, sampleRate, 14);
  const drift = smoothNoise(rand, n, sampleRate, 3);
  const f0 = new Float32Array(n);
  const env = new Float32Array(n);
  const attack = 0.006 * sampleRate;
  const release = 0.025 * sampleRate;
  let segIndex = 0;
  for (let i = 0; i < n; i++) {
    while (segIndex < segments.length - 1 && i >= segments[segIndex].end) segIndex++;
    const seg = segments[segIndex];
    const inside = i >= seg.start && i < seg.end;
    const progress = inside ? (i - seg.start) / (seg.end - seg.start) : 0;
    let pitch = base * seg.pitch * (1.15 - 0.3 * progress) * (1 + flap[i] * 0.15 + drift[i] * 0.1);
    const lastSegment = segIndex === segments.length - 1;
    if (squeak && lastSegment && progress > 0.82) pitch *= 1 + ((progress - 0.82) / 0.18) * 1.6;
    f0[i] = Math.max(15, pitch);
    if (inside) {
      const fadeIn = Math.min(1, (i - seg.start) / attack);
      const fadeOut = Math.min(1, (seg.end - i) / release);
      // La presión cae a lo largo del tramo (y del todo en el pitido final).
      const pressure = 1 - 0.35 * progress - (squeak && lastSegment ? Math.max(0, progress - 0.82) * 2.5 : 0);
      env[i] = seg.amp * fadeIn * fadeOut * Math.max(0.15, pressure);
    }
  }

  const source = pulseTrain(rand, {
    sampleRate,
    f0,
    jitter: 0.06 + voice.wetness * 0.1,
    shimmer: 0.3 + voice.wetness * 0.2,
    openQuotient: 0.35,
    diplophonia: 0.3,
  });

  const body = new Biquad(sampleRate);
  const low = new Biquad(sampleRate).lowpass(700 + tier * 100, 0.9);
  const crackleFilter = new Biquad(sampleRate).bandpass(1500, 1.2);
  const airFilter = new Biquad(sampleRate).lowpass(700);
  const pfffFilter = new Biquad(sampleRate).bandpass(1100, 0.8);
  const clickRate = (voice.wetness * (60 + tier * 20)) / sampleRate;
  let click = 0;
  let clickDecay = 0;

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (i % UPDATE_EVERY === 0) body.bandpass(voice.resonance * (1 + flap[i] * 0.15), 2.5);
    const s = source[i] * env[i];
    // Resonancia del cuerpo + graves + el chasquido seco (de banda ancha) de cada aleteo.
    let sample = body.process(s) + low.process(s) * 0.7 + s * 0.12;

    // Chasquidos húmedos, solo mientras sale el aire.
    if (env[i] > 0.05 && rand() < clickRate) {
      click = range(0.3, 1);
      clickDecay = Math.exp(-1 / (range(0.002, 0.005) * sampleRate));
    }
    click *= clickDecay;
    sample += crackleFilter.process(click * (rand() * 2 - 1)) * 1.4 * voice.wetness;

    // Aire que se escapa durante el pedo…
    const noise = rand() * 2 - 1;
    sample += airFilter.process(noise) * env[i] * voice.breathiness * 0.8;
    // …y el "pfff" final.
    if (i >= bodyEnd) {
      const x = (i - bodyEnd) / (n - bodyEnd);
      sample += pfffFilter.process(noise) * (1 - x) ** 2 * 0.9 * (0.4 + voice.breathiness);
    }
    out[i] = sample;
  }

  normalize(out, 0.9);
  saturate(out, power * 0.9);
  return normalize(out, 0.9);
}

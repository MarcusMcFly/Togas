import { envelope, finish, noiseSource } from '../../../core/audio/synth';
import type { PlayingSound, SoundRecipe } from '../../../core/services/AudioManager';

/** Efectos cortos del aula. Todos terminan solos: no hay bucles que se queden sonando. */

function tone(type: OscillatorType, from: number, to: number, duration: number, peak: number, delay = 0): SoundRecipe {
  return (ctx, destination) => {
    const t0 = ctx.currentTime + 0.005 + delay;
    const end = t0 + duration;
    const output = ctx.createGain();
    output.connect(destination);
    envelope(output.gain, t0, 0.008, peak, end);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, end);
    osc.connect(output);
    osc.start(t0);
    return finish(ctx, output, [osc], end);
  };
}

/** Ruido filtrado con envolvente: base de golpes, pasos, tiza y borrador. */
function noiseHit(type: BiquadFilterType, frequency: number, q: number, duration: number, peak: number, delay = 0, sweepTo?: number): SoundRecipe {
  return (ctx, destination) => {
    const t0 = ctx.currentTime + 0.005 + delay;
    const end = t0 + duration;
    const output = ctx.createGain();
    output.connect(destination);
    envelope(output.gain, t0, Math.min(0.01, duration * 0.2), peak, end);
    const noise = noiseSource(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(frequency, t0);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, end);
    noise.connect(filter).connect(output);
    noise.start(t0);
    return finish(ctx, output, [noise], end);
  };
}

function group(parts: readonly SoundRecipe[]): SoundRecipe {
  return (ctx, destination) => {
    const sounds: PlayingSound[] = parts.map((p) => p(ctx, destination));
    return {
      endsAt: Math.max(...sounds.map((s) => s.endsAt)),
      stop: (fade) => sounds.forEach((s) => s.stop(fade)),
    };
  };
}

/** Tic de presión: más agudo cuanto más llena está. */
export const tickSound = (pressureRatio: number): SoundRecipe => tone('square', 900 + pressureRatio * 900, 700 + pressureRatio * 700, 0.03, 0.04);

/** Latido "pum-pum" cerca del máximo. */
export const heartbeatSound: SoundRecipe = group([tone('sine', 70, 45, 0.12, 0.35), tone('sine', 62, 40, 0.14, 0.28, 0.17)]);

/** Confirmación suave: las dos burbujas centradas. */
export const stableSound: SoundRecipe = group([tone('sine', 1320, 1320, 0.16, 0.06), tone('sine', 1980, 1980, 0.2, 0.04, 0.05)]);

/** Pasos del profe antes de girarse. */
export const footstepsSound: SoundRecipe = group([noiseHit('lowpass', 380, 1, 0.09, 0.22), noiseHit('lowpass', 340, 1, 0.09, 0.2, 0.32)]);

/** Tiza escribiendo. */
export const chalkSound: SoundRecipe = group([noiseHit('bandpass', 3400, 4, 0.05, 0.05), noiseHit('bandpass', 2900, 4, 0.06, 0.05, 0.09)]);

/** La tiza cae y rebota. */
export const chalkDropSound: SoundRecipe = group([
  tone('sine', 2600, 2400, 0.06, 0.1), tone('sine', 2500, 2300, 0.05, 0.07, 0.18), tone('sine', 2450, 2300, 0.04, 0.05, 0.3),
]);

/** Borrado enérgico de la pizarra: ruido que tapa otros ruidos. */
export const eraseSound: SoundRecipe = group([
  noiseHit('bandpass', 900, 0.8, 0.35, 0.16, 0, 1800), noiseHit('bandpass', 1800, 0.8, 0.35, 0.16, 0.38, 900),
  noiseHit('bandpass', 900, 0.8, 0.35, 0.16, 0.76, 1800),
]);

/** Ronquido del compañero dormido. */
export const snoreSound: SoundRecipe = (ctx, destination) => {
  const t0 = ctx.currentTime + 0.005;
  const end = t0 + 1;
  const output = ctx.createGain();
  output.connect(destination);
  envelope(output.gain, t0, 0.25, 0.22, end);
  const noise = noiseSource(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  const am = ctx.createGain();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 32;
  const depth = ctx.createGain();
  depth.gain.value = 0.6;
  lfo.connect(depth).connect(am.gain);
  noise.connect(filter).connect(am).connect(output);
  noise.start(t0);
  lfo.start(t0);
  return finish(ctx, output, [noise, lfo], end);
};

/** "¡OOOH!" de toda la clase. */
export const gaspSound: SoundRecipe = (ctx, destination) => {
  const t0 = ctx.currentTime + 0.005;
  const end = t0 + 0.75;
  const output = ctx.createGain();
  output.connect(destination);
  envelope(output.gain, t0, 0.05, 0.16, end);
  const vowel = ctx.createBiquadFilter();
  vowel.type = 'bandpass';
  vowel.frequency.value = 520;
  vowel.Q.value = 3;
  vowel.connect(output);
  const voices = [180, 205, 233, 260, 300].map((f) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.linearRampToValueAtTime(f * 1.35, t0 + 0.25);
    osc.frequency.linearRampToValueAtTime(f * 1.1, end);
    osc.connect(vowel);
    osc.start(t0);
    return osc;
  });
  return finish(ctx, output, voices, end);
};

/** "Bla, bla, bla" del profe: un "wah-wah" con filtro, sílaba a sílaba. */
export const mumbleSound = (syllables: number, pitch: number): SoundRecipe => (ctx, destination) => {
  const t0 = ctx.currentTime + 0.005;
  const syllable = 0.16;
  const end = t0 + syllables * syllable + 0.05;
  const output = ctx.createGain();
  output.gain.value = 0.0001;
  output.connect(destination);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 6;
  filter.connect(output);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.connect(filter);
  for (let i = 0; i < syllables; i++) {
    const s = t0 + i * syllable;
    const p = pitch * (1 + (Math.random() - 0.5) * 0.2);
    osc.frequency.setValueAtTime(p, s);
    filter.frequency.setValueAtTime(300, s);
    filter.frequency.linearRampToValueAtTime(1100, s + syllable * 0.45);
    filter.frequency.linearRampToValueAtTime(350, s + syllable * 0.95);
    output.gain.setValueAtTime(0.0001, s);
    output.gain.exponentialRampToValueAtTime(0.07, s + 0.03);
    output.gain.exponentialRampToValueAtTime(0.0001, s + syllable * 0.95);
  }
  osc.start(t0);
  return finish(ctx, output, [osc], end);
};

/** Timbre de fin de clase. */
export const bellSound: SoundRecipe = (ctx, destination) => {
  const t0 = ctx.currentTime + 0.005;
  const end = t0 + 1.3;
  const output = ctx.createGain();
  output.connect(destination);
  envelope(output.gain, t0, 0.01, 0.12, end);
  const osc = ctx.createOscillator();
  osc.frequency.value = 2100;
  const trem = ctx.createGain();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 24;
  const depth = ctx.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(trem.gain);
  osc.connect(trem).connect(output);
  osc.start(t0);
  lfo.start(t0);
  return finish(ctx, output, [osc, lfo], end);
};

/** "Silencio cómico" justo antes de un pedo perfecto: un destello agudo y finísimo. */
export const silenceCueSound: SoundRecipe = tone('sine', 2400, 3600, 0.25, 0.03);

export const countdownBeep = tone('sine', 520, 520, 0.14, 0.2);
export const goBeep = tone('sine', 880, 880, 0.28, 0.22);
export const clickSound = tone('triangle', 700, 900, 0.05, 0.1);
export const warningBlip = tone('triangle', 660, 520, 0.12, 0.08);

export const fanfareSound: SoundRecipe = group([523, 659, 784, 1046].map((f, i) => tone('triangle', f, f, 0.18, 0.16, i * 0.09)));

/** Puerta que se cierra de golpe (expulsión). */
export const slamSound: SoundRecipe = group([noiseHit('lowpass', 260, 1, 0.3, 0.4), tone('sine', 90, 40, 0.3, 0.3)]);

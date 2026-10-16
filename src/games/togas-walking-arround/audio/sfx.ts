import type { SoundRecipe } from '../../../core/services/AudioManager';
import { envelope, finish, noiseSource } from '../../../core/audio/synth';

/** Efectos cortos de interfaz y juego. */

function tone(type: OscillatorType, from: number, to: number, duration: number, peak: number, delay = 0): SoundRecipe {
  return (ctx, destination) => {
    const t0 = ctx.currentTime + 0.005 + delay;
    const end = t0 + duration;
    const output = ctx.createGain();
    output.connect(destination);
    envelope(output.gain, t0, 0.01, peak, end);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, end);
    osc.connect(output);
    osc.start(t0);
    return finish(ctx, output, [osc], end);
  };
}

/** "Ñam": dos notas ascendentes; sube de tono cuanto más lleno está el medidor. */
export function pickupSound(gasRatio: number): SoundRecipe {
  const base = 520 + gasRatio * 360;
  return (ctx, destination) => {
    const a = tone('triangle', base, base * 1.5, 0.09, 0.22)(ctx, destination);
    const b = tone('sine', base * 1.5, base * 2, 0.12, 0.16, 0.06)(ctx, destination);
    return {
      endsAt: Math.max(a.endsAt, b.endsAt),
      stop: (fade) => {
        a.stop(fade);
        b.stop(fade);
      },
    };
  };
}

/** Efervescencia + "buuu" descendente al tocar un antigás. */
export const antigasSound: SoundRecipe = (ctx, destination) => {
  const t0 = ctx.currentTime + 0.005;
  const end = t0 + 0.45;
  const output = ctx.createGain();
  output.connect(destination);
  envelope(output.gain, t0, 0.01, 0.3, end);

  const noise = noiseSource(ctx);
  const hiss = ctx.createBiquadFilter();
  hiss.type = 'highpass';
  hiss.frequency.value = 3000;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.4;
  noise.connect(hiss).connect(hissGain).connect(output);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(480, t0);
  osc.frequency.exponentialRampToValueAtTime(110, end);
  osc.connect(output);

  noise.start(t0);
  osc.start(t0);
  return finish(ctx, output, [noise, osc], end);
};

export const jumpSound = tone('triangle', 300, 560, 0.1, 0.07);
export const countdownBeep = tone('sine', 520, 520, 0.14, 0.2);
export const goBeep = tone('sine', 880, 880, 0.28, 0.22);
export const clickSound = tone('triangle', 700, 900, 0.05, 0.1);

/** Silbato de final. */
export const whistleSound: SoundRecipe = (ctx, destination) => {
  const t0 = ctx.currentTime + 0.005;
  const end = t0 + 0.7;
  const output = ctx.createGain();
  output.connect(destination);
  envelope(output.gain, t0, 0.02, 0.18, end);
  const osc = ctx.createOscillator();
  osc.frequency.value = 1500;
  const trill = ctx.createOscillator();
  trill.frequency.value = 28;
  const trillDepth = ctx.createGain();
  trillDepth.gain.value = 60;
  trill.connect(trillDepth).connect(osc.frequency);
  osc.connect(output);
  osc.start(t0);
  trill.start(t0);
  return finish(ctx, output, [osc, trill], end);
};

/** Arpegio de celebración (nivel legendario y récord). */
export const fanfareSound: SoundRecipe = (ctx, destination) => {
  const notes = [523, 659, 784, 1046];
  const parts = notes.map((f, i) => tone('triangle', f, f, 0.18, 0.16, i * 0.09)(ctx, destination));
  return {
    endsAt: Math.max(...parts.map((p) => p.endsAt)),
    stop: (fade) => parts.forEach((p) => p.stop(fade)),
  };
};

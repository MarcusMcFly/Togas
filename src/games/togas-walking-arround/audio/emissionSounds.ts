import type { SoundRecipe } from '../../../core/services/AudioManager';
import type { BurpVoice, FartVoice, SkinDefinition } from '../config/skins.config';
import type { Emission } from '../systems/EmissionSystem';
import { distortionCurve, envelope, finish, noiseSource, variantRandom } from './synth';

/**
 * Resuelve el sonido de una emisión a partir de la skin activa: el sistema de gas
 * nunca menciona a Poio ni a Marcus, solo pide "el eructo de nivel N de esta skin".
 *
 * Los sonidos son sintetizados. Equivalen a la convención de ficheros de la spec
 * (`<skin>_<tipo>_t0N_v0M.ogg`): skin → voz, tipo → receta, tier → intensidad,
 * variante → semilla. Sustituirlos por ficheros solo exige cambiar esta función.
 */
export function emissionSound(skin: SkinDefinition, emission: Emission): SoundRecipe {
  const seed = hashSeed(skin.id, emission.type, emission.tier, emission.variant);
  return emission.type === 'burp'
    ? burpSound(skin.voice.burp, emission.tier, seed)
    : fartSound(skin.voice.fart, emission.tier, seed);
}

function hashSeed(...parts: Array<string | number>): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Eco para el nivel legendario. Devuelve el nodo de entrada. */
function withEcho(ctx: AudioContext, output: AudioNode): GainNode {
  const input = ctx.createGain();
  const delay = ctx.createDelay(1);
  const feedback = ctx.createGain();
  const wet = ctx.createGain();
  delay.delayTime.value = 0.19;
  feedback.gain.value = 0.35;
  wet.gain.value = 0.45;
  input.connect(output);
  input.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(output);
  return input;
}

export function burpSound(voice: BurpVoice, tier: number, seed: number): SoundRecipe {
  return (ctx, destination) => {
    const rand = variantRandom(seed);
    const t0 = ctx.currentTime + 0.01;
    const duration = 0.22 + tier * 0.17 + rand(0, 0.08);
    const end = t0 + duration;
    const pitch = voice.basePitch * (1 + rand(-0.06, 0.06) + (Math.random() - 0.5) * 0.04) * (1 - tier * 0.03);

    const output = ctx.createGain();
    output.connect(destination);
    envelope(output.gain, t0, 0.03, 0.35 + tier * 0.07, end);
    const bus = tier >= 5 ? withEcho(ctx, output) : output;

    // Fuente: oscilador con "gárgara" (vibrato) que cae de tono.
    const osc = ctx.createOscillator();
    osc.type = voice.wave;
    osc.frequency.setValueAtTime(pitch * 1.25, t0);
    osc.frequency.exponentialRampToValueAtTime(pitch, t0 + 0.08);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.8, end);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 9 + rand(0, 6) + tier;
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.value = pitch * (0.08 + 0.03 * tier);
    vibrato.connect(vibratoDepth).connect(osc.frequency);

    // Rugosidad de garganta: modulación rápida de amplitud.
    const rasp = ctx.createGain();
    rasp.gain.value = 1 - voice.roughness * 0.5;
    const raspLfo = ctx.createOscillator();
    raspLfo.frequency.value = 28 + rand(0, 14);
    const raspDepth = ctx.createGain();
    raspDepth.gain.value = voice.roughness * 0.5;
    raspLfo.connect(raspDepth).connect(rasp.gain);

    // Formante: el "color" de la voz de cada skin.
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 2.5;
    formant.frequency.setValueAtTime(voice.formant * 1.3, t0);
    formant.frequency.exponentialRampToValueAtTime(voice.formant * 0.8, end);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1400 + tier * 300;

    osc.connect(rasp).connect(formant).connect(lowpass);
    const body = ctx.createGain();
    body.gain.value = 0.5;
    osc.connect(body).connect(lowpass);

    // Ruido gutural.
    const noise = noiseSource(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 320;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.12 + tier * 0.03;
    noise.connect(noiseFilter).connect(noiseGain).connect(rasp);

    if (tier >= 4) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = distortionCurve(tier * 1.5);
      lowpass.connect(shaper).connect(bus);
    } else {
      lowpass.connect(bus);
    }

    const sources: AudioScheduledSourceNode[] = [osc, vibrato, raspLfo, noise];
    // Sub-octava a partir del nivel 3: más profundidad, no más volumen.
    if (tier >= 3) {
      const sub = ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(pitch / 2, t0);
      sub.frequency.exponentialRampToValueAtTime(pitch * 0.4, end);
      const subGain = ctx.createGain();
      subGain.gain.value = 0.3 + 0.1 * (tier - 3);
      sub.connect(subGain).connect(bus);
      sources.push(sub);
    }

    for (const source of sources) source.start(t0);
    return finish(ctx, output, sources, end + (tier >= 5 ? 0.7 : 0));
  };
}

export function fartSound(voice: FartVoice, tier: number, seed: number): SoundRecipe {
  return (ctx, destination) => {
    const rand = variantRandom(seed);
    const t0 = ctx.currentTime + 0.01;
    const duration = 0.3 + tier * 0.24 + rand(0, 0.1);
    const end = t0 + duration;
    const pitch = voice.basePitch * (1 + rand(-0.08, 0.08) + (Math.random() - 0.5) * 0.04);

    const output = ctx.createGain();
    output.connect(destination);
    envelope(output.gain, t0, 0.015, 0.4 + tier * 0.07, end);
    const bus = tier >= 5 ? withEcho(ctx, output) : output;

    // Tono que se tambalea (más irregular cuanto más nivel) y, desde el nivel 3, un "pfiiu" final.
    const osc = ctx.createOscillator();
    osc.type = voice.wave;
    osc.frequency.setValueAtTime(pitch, t0);
    const steps = 3 + tier;
    const squeak = tier >= 3;
    const wobbleEnd = squeak ? t0 + duration * 0.82 : end;
    for (let i = 1; i <= steps; i++) {
      const at = t0 + ((wobbleEnd - t0) * i) / steps;
      osc.frequency.linearRampToValueAtTime(pitch * rand(0.75, 1.25) * (1 - (i / steps) * 0.2), at);
    }
    if (squeak) osc.frequency.exponentialRampToValueAtTime(pitch * 2.4, end);

    // El "trrrr": compuerta de amplitud a la velocidad de aleteo de la skin.
    const gate = ctx.createGain();
    gate.gain.value = 0.5;
    const flutter = ctx.createOscillator();
    flutter.type = 'square';
    flutter.frequency.setValueAtTime(voice.flutter * (1 + rand(-0.15, 0.15)), t0);
    flutter.frequency.linearRampToValueAtTime(voice.flutter * rand(0.7, 1.1), end);
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.5;
    flutter.connect(flutterDepth).connect(gate.gain);

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 700 + tier * 150;
    tone.Q.value = 3;
    osc.connect(tone).connect(gate);

    // Aire.
    const noise = noiseSource(ctx);
    const air = ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 300 + voice.breathiness * 500;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.25 + voice.breathiness * 0.3;
    noise.connect(air).connect(airGain).connect(gate);

    if (tier >= 2) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = distortionCurve(tier);
      gate.connect(shaper).connect(bus);
    } else {
      gate.connect(bus);
    }

    const sources: AudioScheduledSourceNode[] = [osc, flutter, noise];
    if (tier >= 3) {
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = pitch / 2;
      const subGain = ctx.createGain();
      subGain.gain.value = 0.35;
      sub.connect(subGain).connect(gate);
      sources.push(sub);
    }

    for (const source of sources) source.start(t0);
    return finish(ctx, output, sources, end + (tier >= 5 ? 0.7 : 0));
  };
}

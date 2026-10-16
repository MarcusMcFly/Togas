import { finish } from '../../../core/audio/synth';
import type { SoundRecipe } from '../../../core/services/AudioManager';
import type { SkinDefinition } from '../../../core/characters/SkinDefinition';
import { renderBurp } from '../../../core/characters/voiceSynth';
import type { TrumpetVariant } from '../config/scoring.config';
import { renderSilentFart, renderTrumpetFart } from './classSynth';

/**
 * Sonidos del personaje. Equivale a la convención de ficheros de la spec
 * (`<skin>_silent_fart_01.ogg`, `<skin>_trumpet_fart_02.ogg`, `<skin>_straining_01.ogg`…):
 * la skin aporta la voz y la variante, la semilla. Nada de `if (skin === …)`.
 */

/** Variantes por tipo de sonido (como `_01`, `_02` en los ficheros). */
export const VARIANTS_PER_SOUND = 2;

type Render = (sampleRate: number, seed: number) => Float32Array;

const buffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

function getBuffer(ctx: BaseAudioContext, key: string, render: Render): AudioBuffer {
  let cache = buffers.get(ctx);
  if (!cache) {
    cache = new Map();
    buffers.set(ctx, cache);
  }
  let buffer = cache.get(key);
  if (!buffer) {
    const samples = render(ctx.sampleRate, hashSeed(key));
    buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    cache.set(key, buffer);
  }
  return buffer;
}

interface PlaybackOptions {
  gain: number;
  rate?: number;
  /** El tono cae hasta este factor (p. ej. 0.7 para un "ohhh" decepcionado). */
  rateTo?: number;
  lowpass?: number;
  /** Reverberación de aula (eco en las paredes). */
  room?: number;
}

function playBuffer(key: string, render: Render, o: PlaybackOptions): SoundRecipe {
  return (ctx, destination) => {
    const buffer = getBuffer(ctx, key, render);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const rate = (o.rate ?? 1) * (1 + (Math.random() - 0.5) * 0.05);
    const start = ctx.currentTime + 0.005;
    source.playbackRate.setValueAtTime(rate, start);
    const duration = buffer.duration / rate;
    if (o.rateTo) source.playbackRate.linearRampToValueAtTime(rate * o.rateTo, start + duration);

    const output = ctx.createGain();
    output.gain.value = o.gain;
    let node: AudioNode = source;
    if (o.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = o.lowpass;
      node = node.connect(filter);
    }
    node.connect(output).connect(destination);

    let tail = 0;
    if (o.room) {
      const reverb = ctx.createConvolver();
      reverb.buffer = roomImpulse(ctx);
      const wet = ctx.createGain();
      wet.gain.value = o.room;
      output.connect(reverb).connect(wet).connect(destination);
      tail = 1.1;
    }
    source.start(start);
    // Con rateTo el sonido se alarga al bajar el tono: margen de sobra.
    const end = start + duration * (o.rateTo ? 1.4 : 1) + tail;
    return finish(ctx, output, [source], end);
  };
}

export function silentFartSound(skin: SkinDefinition, tier: number, variant: number): SoundRecipe {
  const key = `${skin.id}_silent_fart_t${tier}_${variant}`;
  return playBuffer(key, (sr, seed) => renderSilentFart(skin.voice.fart, tier, seed, sr), { gain: 0.5 });
}

export function trumpetFartSound(skin: SkinDefinition, variant: TrumpetVariant, intensity: number, n: number): SoundRecipe {
  const key = `${skin.id}_trumpet_fart_${variant}_${n}`;
  return playBuffer(key, (sr, seed) => renderTrumpetFart(skin.voice.fart, variant, intensity, seed, sr), {
    // La intensidad se nota en timbre y eco, no en volumen (seguridad auditiva).
    gain: 0.62 + intensity * 0.03,
    room: 0.12 + intensity * 0.04,
  });
}

/** "Mmmmf": aguantando con la boca cerrada. */
export function strainSound(skin: SkinDefinition, variant: number): SoundRecipe {
  const key = `${skin.id}_straining_${variant}`;
  return playBuffer(key, (sr, seed) => renderBurp(skin.voice.burp, 1, seed, sr), { gain: 0.35, rate: 0.85, lowpass: 420 });
}

/** "Ohhh…": vergüenza tras un trompetazo. */
export function embarrassedSound(skin: SkinDefinition, variant: number): SoundRecipe {
  const key = `${skin.id}_embarrassed_${variant}`;
  return playBuffer(key, (sr, seed) => renderBurp(skin.voice.burp, 2, seed, sr), { gain: 0.4, rate: 1.15, rateTo: 0.65, lowpass: 900 });
}

/** Celebración: un eructo satisfecho, marca de la casa. */
export function victorySound(skin: SkinDefinition): SoundRecipe {
  const key = `${skin.id}_victory`;
  return playBuffer(key, (sr, seed) => renderBurp(skin.voice.burp, 3, seed, sr), { gain: 0.55, rate: 1.1, room: 0.15 });
}

const impulses = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Respuesta de un aula: reflexiones cortas en paredes y pizarra. */
function roomImpulse(ctx: BaseAudioContext): AudioBuffer {
  let impulse = impulses.get(ctx);
  if (!impulse) {
    const length = Math.floor(ctx.sampleRate * 1.1);
    impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp((-i / ctx.sampleRate) * 5) * 0.5;
      for (const [delay, gain] of [[0.018, 0.45], [0.037, 0.3], [0.061, 0.2]] as const) {
        data[Math.floor((delay + channel * 0.003) * ctx.sampleRate)] += gain;
      }
    }
    impulses.set(ctx, impulse);
  }
  return impulse;
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

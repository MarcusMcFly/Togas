import type { SoundRecipe } from '../../../core/services/AudioManager';
import type { SkinDefinition } from '../../../core/characters/CharacterRegistry';
import type { Emission } from '../systems/EmissionSystem';
import { renderBurp, renderFart } from '../../../core/characters/voiceSynth';
import { finish } from '../../../core/audio/synth';

/**
 * Resuelve el sonido de una emisión a partir de la skin activa: el sistema de gas
 * nunca menciona a Pollo ni a Marcus, solo pide "el eructo de nivel N de esta skin".
 *
 * Equivale a la convención de ficheros de la spec (`<skin>_<tipo>_t0N_v0M.ogg`):
 * skin → voz, tipo → sintetizador, tier → intensidad, variante → semilla. Cada
 * combinación se genera una sola vez y se guarda en caché.
 */
export function emissionSound(skin: SkinDefinition, emission: Emission): SoundRecipe {
  return (ctx, destination) => {
    const buffer = getBuffer(ctx, skin, emission);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // Pequeña variación de tono en cada reproducción para que nunca suene idéntico.
    source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.06;

    const output = ctx.createGain();
    output.gain.value = 0.55 + emission.tier * 0.06;
    source.connect(output).connect(destination);

    // Reverberación de calle en los niveles altos: más épico sin subir el volumen.
    let tail = 0;
    if (emission.tier >= 4) {
      const reverb = ctx.createConvolver();
      reverb.buffer = reverbImpulse(ctx);
      const wet = ctx.createGain();
      wet.gain.value = emission.tier >= 5 ? 0.35 : 0.22;
      output.connect(reverb).connect(wet).connect(destination);
      tail = 1.6;
    }

    const start = ctx.currentTime + 0.005;
    source.start(start);
    return finish(ctx, output, [source], start + buffer.duration / source.playbackRate.value + tail);
  };
}

const buffers = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

function getBuffer(ctx: BaseAudioContext, skin: SkinDefinition, emission: Emission): AudioBuffer {
  let cache = buffers.get(ctx);
  if (!cache) {
    cache = new Map();
    buffers.set(ctx, cache);
  }
  const key = `${skin.id}_${emission.type}_t${emission.tier}_v${emission.variant}`;
  let buffer = cache.get(key);
  if (!buffer) {
    const seed = hashSeed(key);
    const samples = emission.type === 'burp'
      ? renderBurp(skin.voice.burp, emission.tier, seed, ctx.sampleRate)
      : renderFart(skin.voice.fart, emission.tier, seed, ctx.sampleRate);
    buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    cache.set(key, buffer);
  }
  return buffer;
}

const impulses = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Respuesta de una calle con fachadas: reflexiones tempranas y cola que decae. */
function reverbImpulse(ctx: BaseAudioContext): AudioBuffer {
  let impulse = impulses.get(ctx);
  if (!impulse) {
    const length = Math.floor(ctx.sampleRate * 1.6);
    impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / ctx.sampleRate;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 3.2) * 0.6;
      }
      // Ecos de las fachadas.
      for (const [delay, gain] of [[0.031, 0.5], [0.057, 0.35], [0.089, 0.25]] as const) {
        data[Math.floor((delay + channel * 0.004) * ctx.sampleRate)] += gain;
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

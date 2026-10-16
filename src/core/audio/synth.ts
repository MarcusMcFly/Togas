import type { PlayingSound } from '../services/AudioManager';

/** Piezas básicas de síntesis compartidas por todos los sonidos del juego. */

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Dos segundos de ruido blanco, reutilizados en cada sonido. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

export function noiseSource(ctx: AudioContext): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;
  return source;
}

/** Envolvente ataque-sostenimiento-caída sobre un parámetro de ganancia. */
export function envelope(param: AudioParam, start: number, attack: number, peak: number, end: number): void {
  param.setValueAtTime(0.0001, start);
  param.exponentialRampToValueAtTime(peak, start + attack);
  param.setValueAtTime(peak, Math.max(start + attack, end - (end - start) * 0.45));
  param.exponentialRampToValueAtTime(0.0001, end);
}

/** Programa el final de todas las fuentes y devuelve el control del sonido. */
export function finish(
  ctx: AudioContext,
  output: GainNode,
  sources: readonly AudioScheduledSourceNode[],
  endsAt: number,
): PlayingSound {
  for (const source of sources) source.stop(endsAt + 0.05);
  let stopped = false;
  return {
    endsAt,
    stop(fade = 0.05) {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      output.gain.cancelScheduledValues(now);
      output.gain.setValueAtTime(output.gain.value, now);
      output.gain.linearRampToValueAtTime(0, now + fade);
      for (const source of sources) {
        try {
          source.stop(now + fade + 0.02);
        } catch {
          // Ya había terminado.
        }
      }
    },
  };
}


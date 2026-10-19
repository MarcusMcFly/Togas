import { describe, expect, it } from 'vitest';
import { renderBurp, renderFart } from '../../src/core/characters/voiceSynth';
import { SKINS } from '../../src/core/characters/CharacterRegistry';

const SR = 22050;
const [pollo, marcus] = SKINS;

function stats(samples: Float32Array) {
  let peak = 0;
  let energy = 0;
  for (const s of samples) {
    expect(Number.isFinite(s)).toBe(true);
    peak = Math.max(peak, Math.abs(s));
    energy += s * s;
  }
  return { peak, rms: Math.sqrt(energy / samples.length), seconds: samples.length / SR };
}

describe('Síntesis de eructos y pedos', () => {
  for (const [name, render] of [['eructo', renderBurp], ['pedo', renderFart]] as const) {
    const voice = (skin: (typeof SKINS)[number]) => (name === 'eructo' ? skin.voice.burp : skin.voice.fart) as never;

    it(`${name}: señal válida, sin picos peligrosos y con cuerpo (no solo un chasquido)`, () => {
      for (let tier = 1; tier <= 5; tier++) {
        const { peak, rms } = stats(render(voice(pollo), tier, 7, SR));
        expect(peak).toBeLessThanOrEqual(0.9001);
        expect(rms).toBeGreaterThan(0.08);
      }
    });

    it(`${name}: más nivel = más largo`, () => {
      const lengths = [1, 2, 3, 4, 5].map((tier) => render(voice(marcus), tier, 7, SR).length);
      for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeGreaterThan(lengths[i - 1]);
    });

    it(`${name}: la misma variante suena siempre igual y otra variante, distinta`, () => {
      expect(render(voice(pollo), 3, 1, SR)).toEqual(render(voice(pollo), 3, 1, SR));
      expect(render(voice(pollo), 3, 1, SR)).not.toEqual(render(voice(pollo), 3, 2, SR));
    });

    it(`${name}: Pollo y Marcus suenan distinto (AC-03)`, () => {
      expect(render(voice(pollo), 2, 1, SR)).not.toEqual(render(voice(marcus), 2, 1, SR));
    });
  }
});

import { describe, expect, it } from 'vitest';
import { Random } from '../../src/core/utils/Random';
import { COLLECTIBLES } from '../../src/games/togas-walking-arround/config/collectibles.config';
import { EmissionSystem, alternatingPolicy } from '../../src/games/togas-walking-arround/systems/EmissionSystem';
import { ScoreSystem } from '../../src/games/togas-walking-arround/systems/ScoreSystem';

describe('ScoreSystem', () => {
  const ids = COLLECTIBLES.map((c) => c.id);

  it('suma los puntos configurados y cuenta cada comida (AC-04)', () => {
    const score = new ScoreSystem(ids);
    for (const item of COLLECTIBLES) score.addCollectible(item.id, item.score);
    const stats = score.snapshot();
    expect(stats.score).toBe(100 + 90 + 75 + 65 + 50);
    expect(stats.totalCollected).toBe(5);
    expect(stats.collected.fabes).toBe(1);
  });

  it('los antigases no quitan puntos', () => {
    const score = new ScoreSystem(ids);
    score.addCollectible('fabes', 100);
    score.recordObstacleHit();
    expect(score.score).toBe(100);
    expect(score.snapshot().obstaclesHit).toBe(1);
  });

  it('cuenta eructos, pedos e intensidad máxima', () => {
    const score = new ScoreSystem(ids);
    score.recordEmission('burp', 1);
    score.recordEmission('fart', 2);
    score.recordEmission('burp', 3);
    expect(score.snapshot()).toMatchObject({ burps: 2, farts: 1, maxTier: 3 });
  });

  it('snapshot es una copia: modificarla no altera el sistema', () => {
    const score = new ScoreSystem(ids);
    score.snapshot().collected.fabes = 99;
    expect(score.snapshot().collected.fabes).toBe(0);
  });
});

describe('EmissionSystem', () => {
  it('alterna eructo y pedo empezando por eructo', () => {
    expect([1, 2, 3, 4].map(alternatingPolicy)).toEqual(['burp', 'fart', 'burp', 'fart']);
  });

  it('elige variantes dentro del rango configurado', () => {
    const system = new EmissionSystem(3, new Random(1));
    for (let i = 1; i <= 50; i++) {
      const variant = system.resolve({ index: i, tier: 5 }).variant;
      expect(variant).toBeGreaterThanOrEqual(0);
      expect(variant).toBeLessThan(3);
    }
  });

  it('admite otra regla de selección sin cambiar el sistema', () => {
    const system = new EmissionSystem(1, new Random(1), () => 'fart');
    expect(system.resolve({ index: 1, tier: 1 }).type).toBe('fart');
  });
});

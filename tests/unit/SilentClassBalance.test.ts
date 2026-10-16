import { describe, expect, it } from 'vitest';
import { Random } from '../../src/core/utils/Random';
import { BALANCE_CONFIG } from '../../src/games/togas-silent-class/config/balance.config';
import { BalanceSystem } from '../../src/games/togas-silent-class/systems/BalanceSystem';
import { PressureSystem } from '../../src/games/togas-silent-class/systems/PressureSystem';

/** Mando "de bot": empuja en contra de la burbuja. */
const steer = (b: BalanceSystem) => ({
  active: true,
  x: Math.max(-1, Math.min(1, -b.state.horizontal * 6)),
  y: Math.max(-1, Math.min(1, -b.state.vertical * 6)),
});

describe('BalanceSystem', () => {
  it('normaliza el mando con zona muerta y eje vertical invertido', () => {
    const r = 70;
    expect(BalanceSystem.normalizeInput(2, -2, r, 0.06)).toEqual({ x: 0, y: 0 });
    const full = BalanceSystem.normalizeInput(140, -140, r, 0.06);
    expect(full.x).toBe(1);
    expect(full.y).toBe(1); // arrastrar hacia arriba sube la burbuja
    expect(BalanceSystem.normalizeInput(-70, 70, r, 0.06)).toEqual({ x: -1, y: -1 });
  });

  it('los ejes son independientes y la diagonal corrige los dos (GAME-002)', () => {
    const run = (x: number, y: number) => {
      const b = new BalanceSystem({ ...BALANCE_CONFIG, baseDrift: 0, pressureDrift: 0, instability: 0, pressureInstability: 0 }, new Random(1));
      for (let i = 0; i < 30; i++) b.update(1 / 60, { active: true, x, y }, 0, 1);
      return b.state;
    };
    const horizontal = run(1, 0);
    expect(horizontal.horizontal).toBeGreaterThan(0.5);
    expect(horizontal.vertical).toBe(0);
    const vertical = run(0, -1);
    expect(vertical.horizontal).toBe(0);
    expect(vertical.vertical).toBeLessThan(-0.5);
    const diagonal = run(1, 1);
    expect(diagonal.horizontal).toBeGreaterThan(0.5);
    expect(diagonal.vertical).toBeGreaterThan(0.5);
  });

  it('da el mismo resultado a 30, 60 y 144 FPS (GAME-013)', () => {
    // La misma secuencia de entrada: cada medio segundo el dedo cambia de posición.
    const sequence = [[0.5, 0.2], [-0.3, 0.6], [0.8, -0.4], [-0.6, -0.1], [0.1, 0.9], [0, -0.5]] as const;
    const simulate = (fps: number) => {
      const b = new BalanceSystem(BALANCE_CONFIG, new Random(42));
      const frames = Math.round(3 * fps);
      for (let i = 0; i < frames; i++) {
        const [x, y] = sequence[Math.min(sequence.length - 1, Math.floor((i / fps) * 2))];
        b.update(1 / fps, { active: true, x, y }, 0.5, 1);
      }
      return b.state;
    };
    const a = simulate(30);
    const b = simulate(60);
    const c = simulate(144);
    for (const other of [b, c]) {
      expect(Math.abs(other.horizontal - a.horizontal)).toBeLessThan(0.03);
      expect(Math.abs(other.vertical - a.vertical)).toBeLessThan(0.03);
    }
  });

  it('exige 350 ms seguidos en el centro para estar estable', () => {
    const b = new BalanceSystem({ ...BALANCE_CONFIG, baseDrift: 0, pressureDrift: 0 }, new Random(3));
    b.update(0.2, { active: true, x: 0, y: 0 }, 0, 1);
    expect(b.isCentered).toBe(true);
    expect(b.isStable).toBe(false);
    b.update(0.2, { active: true, x: 0, y: 0 }, 0, 1);
    expect(b.isStable).toBe(true);
    expect(b.isPerfect).toBe(true);
  });

  it('un jugador que corrige mantiene las burbujas centradas incluso con presión alta', () => {
    const b = new BalanceSystem(BALANCE_CONFIG, new Random(7));
    let centeredTime = 0;
    for (let i = 0; i < 600; i++) {
      b.update(1 / 60, steer(b), 0.95, 1.25);
      if (b.isCentered) centeredTime += 1 / 60;
    }
    expect(centeredTime).toBeGreaterThan(9);
    expect(b.accuracy).toBeGreaterThan(0.85);
  });

  it('sin corrección, la presión alta desequilibra las burbujas', () => {
    const b = new BalanceSystem(BALANCE_CONFIG, new Random(7));
    let maxDeviation = 0;
    for (let i = 0; i < 600; i++) {
      b.update(1 / 60, { active: true, x: 0, y: 0 }, 1, 1);
      maxDeviation = Math.max(maxDeviation, Math.abs(b.state.horizontal), Math.abs(b.state.vertical));
    }
    expect(maxDeviation).toBeGreaterThan(BALANCE_CONFIG.warningThreshold);
  });

  it('clasifica zonas: seguro, deriva, aviso y crítico', () => {
    const b = new BalanceSystem(BALANCE_CONFIG, new Random(1));
    expect(b.zoneOf(0.1)).toBe('safe');
    expect(b.zoneOf(-0.4)).toBe('drift');
    expect(b.zoneOf(0.7)).toBe('warning');
    expect(b.zoneOf(-0.95)).toBe('critical');
  });
});

describe('PressureSystem', () => {
  it('se llena en 8–12 s a dificultad normal y avisa al entrar en crítico', () => {
    const p = new PressureSystem();
    let t = 0;
    let critical = false;
    let forced = false;
    while (!forced && t < 30) {
      const r = p.update(1 / 60, 1);
      critical ||= r.enteredCritical;
      forced = r.forced;
      t += 1 / 60;
    }
    expect(t).toBeGreaterThanOrEqual(8);
    expect(t).toBeLessThanOrEqual(12);
    expect(critical).toBe(true);
  });

  it('tras ventilar vuelve al inicio y no sube durante la recuperación', () => {
    const p = new PressureSystem();
    for (let i = 0; i < 300; i++) p.update(1 / 60, 1);
    p.vent(1);
    expect(p.value).toBe(5);
    expect(p.holdSec).toBe(0);
    p.update(0.5, 1);
    expect(p.value).toBe(5);
    expect(p.inRecovery).toBe(true);
  });

  it('respeta el tope del tutorial: nunca fuerza una emisión', () => {
    const p = new PressureSystem();
    p.cap = 75;
    for (let i = 0; i < 3000; i++) expect(p.update(1 / 60, 1).forced).toBe(false);
    expect(p.value).toBe(75);
  });
});

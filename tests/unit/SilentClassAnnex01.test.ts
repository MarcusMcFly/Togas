import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/services/EventBus';
import { Random } from '../../src/core/utils/Random';
import { BALANCE_CONFIG, balanceCurve } from '../../src/games/togas-silent-class/config/balance.config';
import { GAME_CONFIG } from '../../src/games/togas-silent-class/config/game.config';
import { PRESSURE_CONFIG } from '../../src/games/togas-silent-class/config/pressure.config';
import { STUDENT_REACTIONS } from '../../src/games/togas-silent-class/config/reactions.config';
import { STUDENT_SEATS } from '../../src/games/togas-silent-class/config/students.config';
import { BalanceSystem } from '../../src/games/togas-silent-class/systems/BalanceSystem';
import { ClassroomSimulation } from '../../src/games/togas-silent-class/systems/ClassroomSimulation';
import type { ClassroomEvents } from '../../src/games/togas-silent-class/systems/events';
import { PressureSystem } from '../../src/games/togas-silent-class/systems/PressureSystem';
import { ScoreSystem } from '../../src/games/togas-silent-class/systems/ScoreSystem';
import { StudentReactionSystem } from '../../src/games/togas-silent-class/systems/StudentReactionSystem';

const DT = 1 / 60;
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Jugador "humano": ve la burbuja con 150 ms de retraso y corrige de forma
 * proporcional (sin la precisión perfecta del bot de los otros tests).
 */
function humanHand(delaySec = 0.15, gain = 3) {
  const seen: Array<{ h: number; v: number }> = [];
  const lag = Math.round(delaySec / DT);
  return (state: { horizontal: number; vertical: number }) => {
    seen.push({ h: state.horizontal, v: state.vertical });
    const old = seen.length > lag ? seen[seen.length - 1 - lag] : { h: 0, v: 0 };
    if (seen.length > lag * 4) seen.shift();
    return { x: clamp(-old.h * gain), y: clamp(-old.v * gain) };
  };
}

/** Sesión de equilibrio a presión fija (ya pasado el calentamiento). */
function holdAtPressure(pressure: number, seed: number, seconds = 10, driftScale = 1.25) {
  const b = new BalanceSystem(BALANCE_CONFIG, new Random(seed));
  for (let i = 0; i < BALANCE_CONFIG.warmupSec / DT; i++) b.update(DT, { active: false, x: 0, y: 0 }, pressure, driftScale);
  b.resetPosition();
  const hand = humanHand();
  let centered = 0;
  let stableEver = false;
  let maxSpeed = 0;
  for (let i = 0; i < seconds / DT; i++) {
    const before = { ...b.state };
    b.update(DT, { active: true, ...hand(b.state) }, pressure, driftScale);
    maxSpeed = Math.max(maxSpeed, Math.abs(b.state.horizontal - before.horizontal) / DT, Math.abs(b.state.vertical - before.vertical) / DT);
    if (b.isCentered) centered += DT;
    stableEver ||= b.isStable;
  }
  return { centeredRatio: centered / seconds, stableEver, maxSpeed };
}

/** El profe de espaldas toda la clase: aísla el equilibrio del sigilo. */
function boardSim(seed: number): ClassroomSimulation {
  const sim = new ClassroomSimulation({ seed, perk: null, forgiving: false, tutorial: false });
  sim.professor.setScript('faceBoard');
  return sim;
}

describe('Anexo 01 · IMP-01 arranque', () => {
  it('la clase empieza con 15–20 % de gas y las burbujas en el centro', () => {
    const sim = boardSim(1);
    expect(sim.pressure.value).toBeGreaterThanOrEqual(15);
    expect(sim.pressure.value).toBeLessThanOrEqual(20);
    expect(sim.balance.state).toEqual({ horizontal: 0, vertical: 0 });
  });

  it('la presión arranca suave: nada de picos los primeros segundos', () => {
    const p = new PressureSystem();
    const start = p.value;
    let last = start;
    let maxRate = 0;
    for (let i = 0; i < 60; i++) {
      p.update(DT, 1);
      maxRate = Math.max(maxRate, (p.value - last) / DT);
      last = p.value;
    }
    expect(maxRate).toBeLessThan(PRESSURE_CONFIG.baseRatePerSec * 0.6);
    expect(p.ramp).toBeLessThan(1);
    for (let i = 0; i < PRESSURE_CONFIG.rampSec / DT; i++) p.update(DT, 1);
    expect(p.ramp).toBe(1);
  });

  it('un jugador novato se estabiliza en menos de 3 s (criterio de aceptación)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sim = boardSim(seed);
      const hand = humanHand(0.25, 2);
      sim.press();
      let t = 0;
      while (!sim.readiness.ready && t < 3) {
        const { x, y } = hand(sim.balance.state);
        sim.setInput(x, y);
        sim.update(DT);
        t += DT;
      }
      expect(sim.readiness.ready, `semilla ${seed}`).toBe(true);
    }
  });

  it('la deriva entra poco a poco durante el calentamiento', () => {
    const b = new BalanceSystem(BALANCE_CONFIG, new Random(3));
    expect(b.warmup).toBe(0);
    b.update(BALANCE_CONFIG.warmupSec / 2, { active: false, x: 0, y: 0 }, 0.2, 1);
    expect(b.warmup).toBeGreaterThan(0.2);
    expect(b.warmup).toBeLessThan(0.8);
    b.update(BALANCE_CONFIG.warmupSec, { active: false, x: 0, y: 0 }, 0.2, 1);
    expect(b.warmup).toBe(1);
  });
});

describe('Anexo 01 · IMP-02 inestabilidad', () => {
  it('la curva presión → dificultad es continua, suave y creciente', () => {
    let prev = balanceCurve(BALANCE_CONFIG.curve, 0);
    for (let i = 1; i <= 1000; i++) {
      const now = balanceCurve(BALANCE_CONFIG.curve, i / 1000);
      expect(now.drift).toBeGreaterThanOrEqual(prev.drift);
      expect(now.instability).toBeGreaterThanOrEqual(prev.instability);
      // Ningún salto en las fronteras (25 %, 50 %, 75 %, 90 %).
      expect(now.drift - prev.drift).toBeLessThan(0.002);
      expect(now.instability - prev.instability).toBeLessThan(0.002);
      prev = now;
    }
  });

  it('la corrección máxima siempre supera a la deriva máxima', () => {
    expect(BALANCE_CONFIG.correctionGain).toBeGreaterThan(BALANCE_CONFIG.maxDriftSpeed * 2);
  });

  it('sin tocar el mando, la velocidad de deriva nunca pasa del tope', () => {
    const b = new BalanceSystem(BALANCE_CONFIG, new Random(11));
    for (let i = 0; i < 600; i++) {
      const before = { ...b.state };
      b.update(DT, { active: true, x: 0, y: 0 }, 1, 1.25);
      const speed = Math.max(Math.abs(b.state.horizontal - before.horizontal), Math.abs(b.state.vertical - before.vertical)) / DT;
      if (Math.abs(b.state.horizontal) < 1 && Math.abs(b.state.vertical) < 1) expect(speed).toBeLessThanOrEqual(BALANCE_CONFIG.maxDriftSpeed + 1e-9);
    }
  });

  it.each([0.25, 0.5, 0.75, 0.95])('a %s de presión un jugador hábil sigue controlando', (pressure) => {
    for (let seed = 1; seed <= 15; seed++) {
      const r = holdAtPressure(pressure, seed);
      expect(r.stableEver, `semilla ${seed}`).toBe(true);
      // Exigente pero manejable: cuanto más gas, menos tiempo centrado, pero nunca imposible.
      expect(r.centeredRatio, `semilla ${seed}`).toBeGreaterThan(pressure >= 0.9 ? 0.6 : 0.75);
    }
  });

  it('a 75 % se mantienen 350 ms en zona segura (criterio de aceptación)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const b = new BalanceSystem(BALANCE_CONFIG, new Random(seed));
      for (let i = 0; i < BALANCE_CONFIG.warmupSec / DT; i++) b.update(DT, { active: false, x: 0, y: 0 }, 0.75, 1.25);
      const hand = humanHand();
      let t = 0;
      while (!b.isStable && t < 2) {
        b.update(DT, { active: true, ...hand(b.state) }, 0.75, 1.25);
        t += DT;
      }
      expect(b.isStable, `semilla ${seed}`).toBe(true);
    }
  });
});

describe('Anexo 01 · IMP-03 detección del pedo silencioso', () => {
  it('lo que muestra el HUD coincide siempre con el resultado de soltar', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const sim = boardSim(seed);
      const hand = humanHand(0.12, 2.5);
      const rng = new Random(seed * 7);
      const releaseAt = rng.int(30, 60 * 12);
      sim.press();
      for (let i = 0; i < releaseAt && !sim.ended; i++) {
        if (!sim.isHolding) sim.press();
        const { x, y } = hand(sim.balance.state);
        sim.setInput(x, y);
        sim.update(DT);
      }
      if (sim.ended || !sim.isHolding) continue;
      const shown = sim.readiness;
      // Verde en los niveles ⇔ listo.
      expect(shown.horizontal === 'ready').toBe(shown.ready);
      expect(shown.vertical === 'ready').toBe(shown.ready);
      const result = sim.release();
      if (shown.ready) {
        expect(result.kind).toBe('emission');
        if (result.kind === 'emission') expect(result.outcome.kind).toBe('silent');
      } else if (shown.blocked === 'unbalanced') {
        expect(result.kind === 'emission' && result.outcome.kind).toBe('trumpet');
      } else {
        expect(result.kind).toBe(shown.blocked);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('listo + profe de espaldas + soltar en los últimos 5 s = éxito, también en el último fotograma', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const sim = boardSim(seed);
      const silent: boolean[] = [];
      sim.bus.on('SILENT_EMISSION', (e) => silent.push(!e.detected));
      sim.bus.on('TRUMPET_EMISSION', () => silent.push(false));
      // Juega con cuidado hasta el último fotograma antes del timbre, sin dejar que llegue a 100
      // y soltando flojo (tier 2): con la nube de tier 3 vaciaría el aula antes de tiempo.
      const lastFrame = GAME_CONFIG.session.durationSec - DT * 1.5;
      while (sim.elapsed < lastFrame && !sim.ended) {
        if (!sim.isHolding) sim.press();
        const { horizontal, vertical } = sim.balance.state;
        sim.setInput(clamp(-horizontal * 6), clamp(-vertical * 6));
        sim.update(DT);
        if (sim.elapsed < lastFrame - 2.5 && sim.readiness.ready && sim.pressure.value > 40 && sim.pressure.value < 60) sim.release();
      }
      expect(sim.ended, `semilla ${seed}`).toBeNull();
      expect(sim.timeLeft).toBeLessThan(5);
      expect(sim.readiness.ready, `semilla ${seed}`).toBe(true);
      const before = sim.score.score;
      const result = sim.release();
      expect(result.kind === 'emission' && result.outcome.kind, `semilla ${seed}`).toBe('silent');
      expect(silent[silent.length - 1]).toBe(true);
      expect(sim.score.score).toBeGreaterThan(before);
      // El timbre llega después y no deshace nada.
      sim.update(DT);
      sim.update(DT);
      expect(sim.ended).toBe('time');
      expect(sim.results().silentFarts).toBe(silent.filter(Boolean).length);
      expect(sim.results().score).toBe(sim.score.score);
    }
  });

  it('después del timbre soltar ya no cuenta (ni para bien ni para mal)', () => {
    const sim = boardSim(2);
    sim.press();
    while (!sim.ended) {
      const { horizontal, vertical } = sim.balance.state;
      sim.setInput(clamp(-horizontal * 6), clamp(-vertical * 6));
      sim.update(DT);
      if (sim.pressure.value > 90 && sim.readiness.ready) sim.release();
      if (!sim.isHolding && !sim.ended) sim.press();
    }
    expect(sim.release().kind).toBe('ignored');
    expect(sim.readiness.ready).toBe(false);
  });

  it('durante la recuperación nunca se muestra "listo"', () => {
    const sim = boardSim(4);
    sim.press();
    for (let i = 0; i < 60; i++) sim.update(DT);
    expect(sim.readiness.ready).toBe(true);
    expect(sim.release().kind).toBe('emission');
    sim.press();
    for (let i = 0; i < 40; i++) {
      sim.update(DT);
      expect(sim.readiness.ready).toBe(false);
      expect(sim.readiness.horizontal).not.toBe('ready');
    }
    expect(sim.readiness.blocked).toBe('recovering');
    expect(sim.release().kind).toBe('recovering');
  });

  it('centrado no es lo mismo que confirmado: los 350 ms se ven distintos', () => {
    const b = new BalanceSystem({ ...BALANCE_CONFIG, curve: [{ pressure: 0, drift: 0, instability: 0 }] }, new Random(1));
    b.update(0.1, { active: true, x: 0, y: 0 }, 0, 1);
    expect(b.isCentered).toBe(true);
    expect(b.isStable).toBe(false);
    expect(b.levelStatus(b.state.horizontal, b.isStable)).toBe('settling');
    b.update(0.3, { active: true, x: 0, y: 0 }, 0, 1);
    expect(b.levelStatus(b.state.horizontal, b.isStable)).toBe('ready');
  });

  it('rozar un instante el borde no reinicia la confirmación', () => {
    const b = new BalanceSystem({ ...BALANCE_CONFIG, curve: [{ pressure: 0, drift: 0, instability: 0 }], inputResponseSec: 1e-4 }, new Random(1));
    b.update(0.2, { active: true, x: 0, y: 0 }, 0, 1);
    // Empuja justo hasta pasar 0,18 sin salir del margen (0,22).
    while (Math.abs(b.state.horizontal) < BALANCE_CONFIG.safeThreshold + 0.01) b.update(1 / 120, { active: true, x: 1, y: 0 }, 0, 1);
    expect(b.isCentered).toBe(false);
    expect(b.isCounting).toBe(true);
    b.update(0.2, { active: true, x: 0, y: 0 }, 0, 1);
    expect(b.isStable).toBe(true);
  });
});

describe('Anexo 01 · IMP-04 reacciones de los compañeros', () => {
  const make = () => new StudentReactionSystem(STUDENT_SEATS, GAME_CONFIG.playerSeat);
  const ids = STUDENT_SEATS.map((s) => s.id);
  const silent = (pressure: number, affected = ids.slice(0, 2), extra: Partial<Parameters<StudentReactionSystem['react']>[0]> = {}) => ({
    kind: 'silent' as const, pressure, perfect: false, reach: 400, affected, asleep: [], trumpetIntensity: 0, rewarded: true, ...extra,
  });

  it('la intensidad escala con la presión', () => {
    const mean = (pressure: number) => {
      const r = make().react(silent(pressure, ids), new Random(1));
      return r.students.reduce((n, s) => n + s.intensity, 0) / r.students.length;
    };
    expect(mean(20)).toBeLessThan(mean(55));
    expect(mean(55)).toBeLessThan(mean(95));
    const low = make().react(silent(15), new Random(2)).students;
    expect(low.every((s) => s.anim === 'confused')).toBe(true);
    const high = make().react(silent(100, [ids[10]], { asleep: [ids[10]] }), new Random(2)).students;
    expect(high[0].anim).toBe('recoil');
  });

  it('el más lejano recibe menos que el más cercano', () => {
    const r = make().react(silent(80, ['c1', 'a1']), new Random(3)).students;
    const near = r.find((s) => s.studentId === 'c1')!;
    const far = r.find((s) => s.studentId === 'a1')!;
    expect(near.distance).toBeLessThan(far.distance);
    expect(near.intensity).toBeGreaterThan(far.intensity);
  });

  it('las reacciones varían entre emisiones y respetan los pesos configurados', () => {
    const seen = new Set<string>();
    const rng = new Random(9);
    for (let i = 0; i < 60; i++) for (const s of make().react(silent(50, ids), rng).students) seen.add(s.reactionId);
    expect(seen.size).toBeGreaterThanOrEqual(3);
    for (const id of seen) expect(STUDENT_REACTIONS.some((d) => d.id === id)).toBe(true);
  });

  it('nadie reacciona dos veces en la misma emisión', () => {
    const r = make().react(silent(90, ['c1', 'c1', 'b2', 'c1']), new Random(1));
    expect(r.students.map((s) => s.studentId)).toEqual(['c1', 'b2']);
  });

  it('titulares: contaminación, apocalipsis y desastre de trompeta', () => {
    expect(make().react(silent(50, ids.slice(0, 3)), new Random(1)).headline?.id).toBe('contamination');
    expect(make().react(silent(50, ids.slice(0, 2)), new Random(1)).headline).toBeNull();
    const apocalypse = make().react(silent(90, ['c1', 'c2'], { perfect: true, asleep: ['c1'] }), new Random(1));
    expect(apocalypse.headline?.id).toBe('silentApocalypse');
    expect(apocalypse.students.find((s) => s.studentId === 'c1')?.anim).toBe('deepSleep');
    const trumpet = make().react({ ...silent(90, ids), kind: 'trumpet', trumpetIntensity: 4, rewarded: false }, new Random(1));
    expect(trumpet.headline?.id).toBe('trumpetDisaster');
    expect(trumpet.students.every((s) => s.anim === 'startled' && s.bonus === 0)).toBe(true);
  });

  it('sin recompensa (profe mirando) se ve la reacción pero no da puntos', () => {
    const r = make().react(silent(95, ids, { rewarded: false }), new Random(1));
    expect(r.students.length).toBe(ids.length);
    expect(r.students.every((s) => s.bonus === 0)).toBe(true);
    expect(r.headline?.bonus).toBe(0);
  });

  it('cada compañero guarda su propia reacción y se le pasa', () => {
    const students = make();
    students.react(silent(60, ['c1']), new Random(1));
    expect(students.reactionOf('c1')).not.toBeNull();
    expect(students.reactionOf('c2')).toBeNull();
    students.update(5);
    expect(students.reactionOf('c1')).toBeNull();
  });

  it('el bonus se paga una vez por compañero y emisión, y se suma al de dormirlo', () => {
    const bus = new EventBus<ClassroomEvents>();
    const score = new ScoreSystem(bus);
    const reaction = {
      emissionId: 1, kind: 'silent' as const, studentId: 'c1', reactionId: 'directHit', message: '', color: '', anim: 'recoil' as const,
      intensity: 1, bonus: 25, distance: 100,
    };
    bus.emit('STUDENT_FELL_ASLEEP', { studentId: 'c1' });
    const knockout = score.score;
    bus.emit('STUDENT_REACTION', reaction);
    bus.emit('STUDENT_REACTION', reaction);
    expect(score.score).toBe(knockout + 25);
    bus.emit('STUDENT_REACTION', { ...reaction, emissionId: 2 });
    expect(score.score).toBe(knockout + 50);
    bus.emit('CLASS_REACTION', { emissionId: 2, kind: 'silent', id: 'contamination', message: '', color: '', bonus: 30 });
    bus.emit('CLASS_REACTION', { emissionId: 2, kind: 'silent', id: 'contamination', message: '', color: '', bonus: 30 });
    expect(score.score).toBe(knockout + 80);
  });

  it('en partida: cada afectado reacciona una sola vez por emisión', () => {
    const sim = boardSim(6);
    const perEmission = new Map<number, string[]>();
    sim.bus.on('STUDENT_REACTION', (e) => perEmission.set(e.emissionId, [...(perEmission.get(e.emissionId) ?? []), e.studentId]));
    const affected = new Map<number, number>();
    let emission = 0;
    sim.bus.on('SILENT_EMISSION', () => (emission++, affected.set(emission, 0)));
    sim.bus.on('TRUMPET_EMISSION', () => (emission++, affected.set(emission, 0)));
    const count = () => affected.set(emission, (affected.get(emission) ?? 0) + 1);
    sim.bus.on('STUDENT_FELL_ASLEEP', count);
    sim.bus.on('STUDENT_DROWSY', count);
    sim.bus.on('STUDENT_STARTLED', count);
    sim.press();
    while (!sim.ended) {
      if (!sim.isHolding) sim.press();
      const { horizontal, vertical } = sim.balance.state;
      sim.setInput(clamp(-horizontal * 6), clamp(-vertical * 6));
      sim.update(DT);
      if (sim.readiness.ready && sim.pressure.value > 60) sim.release();
    }
    expect(perEmission.size).toBeGreaterThan(3);
    for (const [id, list] of perEmission) {
      expect(new Set(list).size).toBe(list.length);
      expect(list.length).toBe(affected.get(id));
    }
  });
});

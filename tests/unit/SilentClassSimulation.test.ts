import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../../src/games/togas-silent-class/config/game.config';
import { ClassroomSimulation } from '../../src/games/togas-silent-class/systems/ClassroomSimulation';

const DT = 1 / 60;

/**
 * Bot "jugador cuidadoso": mantiene pulsado, corrige las burbujas y suelta solo cuando
 * están estables y el profe está de espaldas, en cuanto hay algo de presión.
 */
function playCarefully(sim: ClassroomSimulation, minPressure = 35): void {
  sim.press();
  let guard = 0;
  while (!sim.ended && guard++ < 60 * 120) {
    const { horizontal, vertical } = sim.balance.state;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    if (!sim.isHolding) sim.press();
    sim.setInput(clamp(-horizontal * 6), clamp(-vertical * 6));
    sim.update(DT);
    const away = sim.professor.attention === 'away';
    if (sim.isHolding && away && sim.balance.isStable && sim.pressure.value >= minPressure && !sim.pressure.inRecovery) {
      sim.release();
    }
  }
}

describe('ClassroomSimulation', () => {
  it('una sesión dura 90 s y termina sola', () => {
    const sim = new ClassroomSimulation({ seed: 1, perk: null, forgiving: false, tutorial: false });
    sim.press();
    let t = 0;
    while (!sim.ended && t < 200) {
      sim.update(DT);
      t += DT;
    }
    expect(sim.ended).not.toBeNull();
    expect(t).toBeLessThanOrEqual(GAME_CONFIG.session.durationSec + 0.1);
  });

  it('si nunca se suelta, la presión fuerza trompetazos y acaba en expulsión (GAME-006)', () => {
    const sim = new ClassroomSimulation({ seed: 2, perk: null, forgiving: false, tutorial: false });
    const trumpets: boolean[] = [];
    sim.bus.on('TRUMPET_EMISSION', (e) => trumpets.push(e.forced));
    let t = 0;
    while (!sim.ended && t < 100) {
      if (!sim.isHolding) sim.press();
      sim.update(DT);
      t += DT;
    }
    expect(trumpets.length).toBe(3);
    expect(trumpets.every(Boolean)).toBe(true);
    expect(sim.ended).toBe('expelled');
  });

  it('soltar desequilibrado es trompetazo y aviso (GAME-005)', () => {
    const sim = new ClassroomSimulation({ seed: 3, perk: null, forgiving: false, tutorial: false });
    const strikes: number[] = [];
    sim.bus.on('PROFESSOR_DETECTED_PLAYER', (e) => strikes.push(e.strikes));
    sim.press();
    sim.setInput(1, 1);
    for (let i = 0; i < 90; i++) sim.update(DT);
    const result = sim.release();
    expect(result.kind).toBe('emission');
    if (result.kind === 'emission') expect(result.outcome.kind).toBe('trumpet');
    expect(strikes).toEqual([1]);
  });

  it('un toque cancelado no provoca ningún pedo', () => {
    const sim = new ClassroomSimulation({ seed: 4, perk: null, forgiving: false, tutorial: false });
    let emissions = 0;
    sim.bus.on('TRUMPET_EMISSION', () => emissions++);
    sim.bus.on('SILENT_EMISSION', () => emissions++);
    sim.press();
    sim.setInput(1, 1);
    for (let i = 0; i < 60; i++) sim.update(DT);
    sim.cancel();
    expect(sim.release().kind).toBe('ignored');
    expect(emissions).toBe(0);
  });

  it('un toque demasiado corto no cuenta como intento', () => {
    const sim = new ClassroomSimulation({ seed: 4, perk: null, forgiving: false, tutorial: false });
    sim.press();
    sim.update(0.05);
    expect(sim.release().kind).toBe('tooShort');
  });

  it('un jugador cuidadoso siempre encuentra ventanas: nunca llega a presión 100 (GAME-014)', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const sim = new ClassroomSimulation({ seed, perk: null, forgiving: false, tutorial: false });
      let forced = 0;
      let silent = 0;
      sim.bus.on('TRUMPET_EMISSION', (e) => (forced += e.forced ? 1 : 0));
      sim.bus.on('SILENT_EMISSION', (e) => (silent += e.detected ? 0 : 1));
      playCarefully(sim);
      expect(forced, `semilla ${seed}`).toBe(0);
      expect(silent, `semilla ${seed}`).toBeGreaterThanOrEqual(5);
      const results = sim.results();
      expect(results.detections).toBe(0);
      expect(results.accuracy).toBeGreaterThan(0.7);
    }
  });

  it('las estadísticas salen de eventos reales y nadie puntúa dos veces (GAME-011)', () => {
    const sim = new ClassroomSimulation({ seed: 9, perk: null, forgiving: false, tutorial: false });
    const asleepEvents = new Set<string>();
    let duplicates = 0;
    sim.bus.on('STUDENT_FELL_ASLEEP', (e) => {
      if (asleepEvents.has(e.studentId)) duplicates++;
      asleepEvents.add(e.studentId);
    });
    playCarefully(sim, 80);
    const results = sim.results();
    expect(duplicates).toBe(0);
    expect(results.studentsKnockedOut).toBe(asleepEvents.size);
    expect(results.completion).toBeCloseTo(asleepEvents.size / 12);
    expect(results.score).toBeGreaterThan(0);
    if (results.studentsKnockedOut === 12) expect(results.endReason).toBe('cleared');
  });

  it('esperando a presión alta, un buen jugador puede dormir a toda la clase', () => {
    let cleared = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const sim = new ClassroomSimulation({ seed, perk: null, forgiving: false, tutorial: false });
      playCarefully(sim, 82);
      if (sim.ended === 'cleared') cleared++;
    }
    expect(cleared).toBeGreaterThan(0);
  });

  it('tutorial: sin reloj ni avisos; soltar con el profe mirando no hace nada', () => {
    const sim = new ClassroomSimulation({ seed: 5, perk: null, forgiving: false, tutorial: true });
    for (let i = 0; i < 60 * 120; i++) sim.update(DT);
    expect(sim.ended).toBeNull();
    expect(sim.professor.attention).toBe('facing');
    sim.press();
    for (let i = 0; i < 60; i++) sim.update(DT);
    expect(sim.release().kind).toBe('professorWatching');
    expect(sim.stealth.strikes).toBe(0);
  });
});

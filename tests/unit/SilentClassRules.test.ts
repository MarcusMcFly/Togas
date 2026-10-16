import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/services/EventBus';
import { Random } from '../../src/core/utils/Random';
import {
  EMISSION_TIERS, SCORING, comboMultiplier, emissionTier, performanceTitle, type TitleInput,
} from '../../src/games/togas-silent-class/config/scoring.config';
import { STUDENT_SEATS } from '../../src/games/togas-silent-class/config/students.config';
import { GAME_CONFIG } from '../../src/games/togas-silent-class/config/game.config';
import { DifficultySystem } from '../../src/games/togas-silent-class/systems/DifficultySystem';
import { resolveRelease } from '../../src/games/togas-silent-class/systems/EmissionSystem';
import type { ClassroomEvents } from '../../src/games/togas-silent-class/systems/events';
import { ScoreSystem } from '../../src/games/togas-silent-class/systems/ScoreSystem';
import { StealthSystem } from '../../src/games/togas-silent-class/systems/StealthSystem';
import { StudentReactionSystem } from '../../src/games/togas-silent-class/systems/StudentReactionSystem';

describe('EmissionSystem', () => {
  it('solo es silencioso con las dos burbujas estables (GAME-003)', () => {
    expect(resolveRelease({ stable: true, perfect: false, pressure: 50, forced: false }).kind).toBe('silent');
    expect(resolveRelease({ stable: false, perfect: false, pressure: 50, forced: false }).kind).toBe('trumpet');
  });

  it('a presión máxima siempre es trompetazo, el más espectacular (GAME-006)', () => {
    const outcome = resolveRelease({ stable: true, perfect: true, pressure: 100, forced: true });
    expect(outcome).toMatchObject({ kind: 'trumpet', variant: 'finale', forced: true });
  });

  it('el nivel de la nube sigue la tabla de presión', () => {
    expect(emissionTier(10).name).toBe('Susurro');
    expect(emissionTier(45).tier).toBe(2);
    expect(emissionTier(79).tier).toBe(3);
    expect(emissionTier(85).tier).toBe(4);
    expect(emissionTier(97).tier).toBe(5);
  });
});

describe('StealthSystem', () => {
  it('tres avisos y fuera', () => {
    const s = new StealthSystem(3, new Random(1), false);
    expect(s.strike('trumpet')).toEqual({ strikes: 1, absorbed: false, expelled: false });
    s.strike('seen');
    expect(s.strike('trumpet').expelled).toBe(true);
  });

  it('la Silla Insonorizada se come solo el primer trompetazo', () => {
    const s = new StealthSystem(3, new Random(1), true);
    expect(s.strike('seen').absorbed).toBe(false);
    expect(s.strike('trumpet')).toMatchObject({ absorbed: true, strikes: 1 });
    expect(s.strike('trumpet')).toMatchObject({ absorbed: false, strikes: 2 });
  });

  it('de espaldas nunca te pilla; investigando, siempre (GAME-004)', () => {
    const s = new StealthSystem(3, new Random(1), false);
    for (let i = 0; i < 100; i++) expect(s.noticesSilent(0)).toBe(false);
    expect(s.noticesSilent(1)).toBe(true);
  });
});

describe('StudentReactionSystem', () => {
  const make = () => new StudentReactionSystem(STUDENT_SEATS, GAME_CONFIG.playerSeat);

  it('la nube duerme a los más cercanos dentro del alcance (GAME-007)', () => {
    const students = make();
    const legendary = EMISSION_TIERS[4];
    const result = students.applyCloud(legendary, new Random(5));
    expect(result.asleep.length).toBeGreaterThanOrEqual(legendary.minTargets);
    expect(result.asleep.length).toBeLessThanOrEqual(legendary.maxTargets);
    const distances = students.all.map((s) => s.distance);
    const asleepMax = Math.max(...students.all.filter((s) => s.knockedOut).map((s) => s.distance));
    const awakeMin = Math.min(...students.all.filter((s) => !s.knockedOut).map((s) => s.distance), Infinity);
    expect(asleepMax).toBeLessThanOrEqual(awakeMin);
    expect(distances.length).toBe(12);
  });

  it('cada compañero cuenta como noqueado una sola vez, aunque le despierte un trompetazo', () => {
    const students = make();
    const big = EMISSION_TIERS[4];
    const first = students.applyCloud(big, new Random(1)).asleep;
    students.startle(5);
    students.update(5);
    for (const id of first) expect(students.stateOf(id)).toBe('asleep');
    const second = students.applyCloud(big, new Random(1)).asleep;
    expect(second.some((id) => first.includes(id))).toBe(false);
  });

  it('si el profe mira, la nube solo adormila', () => {
    const students = make();
    const result = students.applyCloud(EMISSION_TIERS[3], new Random(1), false);
    expect(result.asleep).toEqual([]);
    expect(result.drowsy.length).toBeGreaterThan(0);
    students.update(10);
    expect(students.all.every((s) => s.state === 'awake')).toBe(true);
  });
});

describe('ScoreSystem', () => {
  const setup = () => {
    const bus = new EventBus<ClassroomEvents>();
    return { bus, score: new ScoreSystem(bus) };
  };
  const silent = (pressure: number, perfect = false, detected = false) =>
    ({ pressure, tier: emissionTier(pressure).tier, perfect, detected, holdSec: 5 });

  it('aplica la tabla de puntos', () => {
    const { bus, score } = setup();
    bus.emit('SILENT_EMISSION', silent(85, true));
    expect(score.score).toBe(SCORING.quietRelease + SCORING.perfectRelease + SCORING.highPressureRelease);
    bus.emit('STUDENT_FELL_ASLEEP', { studentId: 'a1' });
    expect(score.score).toBe(30 + 50 + 75 + 100);
  });

  it('la racha multiplica solo los compañeros dormidos', () => {
    const { bus, score } = setup();
    for (let i = 0; i < 3; i++) bus.emit('SILENT_EMISSION', silent(10));
    const before = score.score;
    bus.emit('STUDENT_FELL_ASLEEP', { studentId: 'a1' });
    expect(score.score - before).toBe(Math.round(100 * comboMultiplier(3)));
    expect(comboMultiplier(3)).toBe(1.2);
    expect(comboMultiplier(9)).toBe(1.5);
  });

  it('bonus de racha a las 5 seguidas y la detección la reinicia', () => {
    const { bus, score } = setup();
    for (let i = 0; i < 5; i++) bus.emit('SILENT_EMISSION', silent(10));
    expect(score.score).toBe(5 * SCORING.quietRelease + SCORING.streakBonus);
    bus.emit('SILENT_EMISSION', silent(10, false, true));
    bus.emit('PROFESSOR_DETECTED_PLAYER', { reason: 'seen', strikes: 1, absorbed: false, expelled: false });
    expect(score.streak).toBe(0);
    expect(score.snapshot().bestStreak).toBe(5);
  });

  it('la puntuación nunca baja de cero', () => {
    const { bus, score } = setup();
    bus.emit('TRUMPET_EMISSION', { pressure: 50, variant: 'short', intensity: 1, forced: false, duringSilence: false, holdSec: 3 });
    expect(score.score).toBe(0);
    expect(score.snapshot().trumpetFarts).toBe(1);
  });
});

describe('DifficultySystem', () => {
  it('tres fases a los 0, 25 y 60 s', () => {
    expect(DifficultySystem.phaseAt(0)).toBe('settling');
    expect(DifficultySystem.phaseAt(30)).toBe('suspicion');
    expect(DifficultySystem.phaseAt(75)).toBe('final');
  });

  it('los ajustes adaptativos están acotados', () => {
    expect(DifficultySystem.driftRelief(0)).toBe(1);
    expect(DifficultySystem.driftRelief(100)).toBeGreaterThanOrEqual(0.7);
    expect(DifficultySystem.streakPressure(0)).toBe(1);
    expect(DifficultySystem.streakPressure(100)).toBeLessThanOrEqual(1.2);
  });

  it('Glúteos de Acero solo ayudan los primeros 20 s', () => {
    const d = new DifficultySystem('ironCheeks', false);
    const plain = new DifficultySystem(null, false);
    const at = (sys: DifficultySystem, t: number) => sys.evaluate({ elapsedSec: t, failuresInRow: 0, streak: 0 }).drift;
    expect(at(d, 5)).toBeLessThan(at(plain, 5));
    expect(at(d, 21)).toBe(at(plain, 21));
  });
});

describe('Títulos', () => {
  const base: TitleInput = { silentFarts: 8, trumpetFarts: 1, detections: 1, studentsKnockedOut: 6, totalStudents: 12, accuracy: 0.8 };
  it('se eligen por umbrales, sin azar', () => {
    expect(performanceTitle({ ...base, studentsKnockedOut: 12, detections: 0 }).id).toBe('doctor');
    expect(performanceTitle({ ...base, trumpetFarts: 5, silentFarts: 2 }).id).toBe('brass');
    expect(performanceTitle({ ...base, accuracy: 0.3 }).id).toBe('nervous');
    expect(performanceTitle({ ...base, studentsKnockedOut: 10, detections: 0 }).id).toBe('legend');
    expect(performanceTitle({ ...base, studentsKnockedOut: 8 }).id).toBe('ghost');
    expect(performanceTitle(base).id).toBe('engineer');
    expect(performanceTitle({ ...base, studentsKnockedOut: 2 }).id).toBe('intern');
  });
});

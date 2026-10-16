import { EventBus } from '../../../core/services/EventBus';
import { Random } from '../../../core/utils/Random';
import { BALANCE_CONFIG } from '../config/balance.config';
import { GAME_CONFIG } from '../config/game.config';
import type { PerkId } from '../config/perks.config';
import { performanceTitle } from '../config/scoring.config';
import { STUDENT_SEATS } from '../config/students.config';
import { BalanceSystem } from './BalanceSystem';
import { DifficultySystem, type DifficultyOutput } from './DifficultySystem';
import { resolveRelease, type EmissionOutcome } from './EmissionSystem';
import type { ClassroomEvents, EndReason } from './events';
import { PressureSystem } from './PressureSystem';
import { ProfessorAI } from './ProfessorAI';
import { ScoreSystem, type ClassroomStats } from './ScoreSystem';
import { StealthSystem } from './StealthSystem';
import { StudentReactionSystem } from './StudentReactionSystem';

export interface SimulationOptions {
  seed: number;
  perk: PerkId | null;
  forgiving: boolean;
  /**
   * Tutorial: sin reloj, sin avisos ni presión crítica, y soltar mientras el profe
   * mira no hace nada (se puede repetir sin castigo).
   */
  tutorial: boolean;
}

/** Qué ha pasado al levantar el dedo. */
export type ReleaseResult =
  | { kind: 'ignored' }
  | { kind: 'tooShort' }
  | { kind: 'recovering' }
  | { kind: 'professorWatching' }
  | { kind: 'emission'; outcome: EmissionOutcome };

export interface ClassroomResults extends ClassroomStats {
  totalStudents: number;
  /** Precisión media del equilibrio (0–1). */
  accuracy: number;
  completion: number;
  endReason: EndReason;
  title: { id: string; name: string };
}

/** ID del protagonista como objetivo del profe. */
export const PLAYER_TARGET = 'player';

/**
 * La partida completa sin Phaser: une equilibrio, presión, profesor, sigilo,
 * compañeros, puntos y dificultad. La escena solo le pasa la entrada y dibuja
 * su estado; los efectos y sonidos cuelgan de `bus`.
 */
export class ClassroomSimulation {
  readonly bus = new EventBus<ClassroomEvents>();
  readonly balance: BalanceSystem;
  readonly pressure: PressureSystem;
  readonly professor: ProfessorAI;
  readonly stealth: StealthSystem;
  readonly students: StudentReactionSystem;
  readonly score: ScoreSystem;
  private readonly difficulty: DifficultySystem;
  private readonly rng: Random;
  private current: DifficultyOutput;
  private holding = false;
  /** Duración del toque actual (para ignorar toques demasiado cortos). */
  private touchSec = 0;
  private readonly input = { x: 0, y: 0 };
  private elapsedSec = 0;
  private endReason: EndReason | null = null;

  constructor(private readonly options: SimulationOptions) {
    this.rng = new Random(options.seed);
    this.difficulty = new DifficultySystem(options.perk, options.forgiving);
    this.current = this.difficulty.evaluate({ elapsedSec: 0, failuresInRow: 0, streak: 0 });

    this.balance = new BalanceSystem(BALANCE_CONFIG, this.rng);
    this.pressure = new PressureSystem();
    if (options.tutorial) this.pressure.cap = 75;
    this.stealth = new StealthSystem(GAME_CONFIG.session.maxStrikes, this.rng, options.perk === 'soundproofChair');
    this.students = new StudentReactionSystem(STUDENT_SEATS, GAME_CONFIG.playerSeat);
    this.score = new ScoreSystem(this.bus);
    this.professor = new ProfessorAI(
      this.rng,
      { notesPerk: options.perk === 'professorNotes', sleepingSeat: () => this.students.pickSleeping(this.rng) },
      {
        stateChanged: (state, attention, targetSeatId) => this.bus.emit('PROFESSOR_STATE', { state, attention, targetSeatId }),
        randomEvent: (kind, seatId) => this.bus.emit('RANDOM_EVENT', { kind, seatId }),
      },
      this.current,
    );
    if (options.tutorial) this.professor.setScript('faceClass');
  }

  get elapsed(): number {
    return this.elapsedSec;
  }

  get timeLeft(): number {
    return Math.max(0, GAME_CONFIG.session.durationSec - this.elapsedSec);
  }

  get isHolding(): boolean {
    return this.holding;
  }

  get ended(): EndReason | null {
    return this.endReason;
  }

  get difficultyNow(): DifficultyOutput {
    return this.current;
  }

  get joystick(): Readonly<{ x: number; y: number }> {
    return this.input;
  }

  /** Dedo abajo: el personaje aprieta y empieza a equilibrar. */
  press(): void {
    if (this.endReason) return;
    this.holding = true;
    this.touchSec = 0;
  }

  /** Desplazamiento del mando ya normalizado (-1…1 por eje; y positivo = arriba). */
  setInput(x: number, y: number): void {
    this.input.x = x;
    this.input.y = y;
  }

  /** Toque cancelado o foco perdido: se suelta el control SIN tirarse un pedo. */
  cancel(): void {
    this.holding = false;
    this.setInput(0, 0);
    this.balance.releaseControl();
  }

  /** Dedo arriba: intento de liberación. */
  release(): ReleaseResult {
    if (!this.holding || this.endReason) return { kind: 'ignored' };
    this.holding = false;
    this.setInput(0, 0);
    if (this.touchSec < GAME_CONFIG.session.minHoldSec) {
      this.balance.releaseControl();
      return { kind: 'tooShort' };
    }
    if (this.pressure.inRecovery) {
      this.balance.releaseControl();
      return { kind: 'recovering' };
    }
    if (this.options.tutorial && this.professor.attention !== 'away' && this.professor.attention !== 'aboutToTurn') {
      this.balance.releaseControl();
      return { kind: 'professorWatching' };
    }
    const outcome = resolveRelease({
      stable: this.balance.isStable,
      perfect: this.balance.isPerfect,
      pressure: this.pressure.value,
      forced: false,
    });
    this.emit(outcome);
    return { kind: 'emission', outcome };
  }

  update(dt: number): void {
    if (this.endReason) return;
    if (!this.options.tutorial) {
      this.elapsedSec += dt;
      if (this.elapsedSec >= GAME_CONFIG.session.durationSec) {
        this.elapsedSec = GAME_CONFIG.session.durationSec;
        this.end('time');
        return;
      }
    }

    this.current = this.difficulty.evaluate({
      elapsedSec: this.elapsedSec,
      failuresInRow: this.score.failuresInRow,
      streak: this.score.streak,
    });

    if (this.holding) this.touchSec += dt;
    this.balance.update(dt, { active: this.holding, x: this.input.x, y: this.input.y }, this.pressure.ratio, this.current.drift);
    if (this.balance.justStabilized) this.bus.emit('BALANCE_STABILIZED', {});
    if (this.balance.justLost) this.bus.emit('BALANCE_LOST', {});

    const pressure = this.pressure.update(dt, this.current.pressureRate);
    if (pressure.enteredCritical) this.bus.emit('GAS_PRESSURE_CRITICAL', { pressure: this.pressure.value });
    if (pressure.forced) {
      this.holding = false;
      this.setInput(0, 0);
      this.emit(resolveRelease({ stable: false, perfect: false, pressure: this.pressure.value, forced: true }));
    }

    this.professor.update(dt, this.current);
    this.students.update(dt);
  }

  results(): ClassroomResults {
    const stats = this.score.snapshot();
    const totalStudents = this.students.total;
    const accuracy = this.balance.accuracy;
    return {
      ...stats,
      totalStudents,
      accuracy,
      completion: stats.studentsKnockedOut / totalStudents,
      endReason: this.endReason ?? 'time',
      title: performanceTitle({ ...stats, totalStudents, accuracy }),
    };
  }

  dispose(): void {
    this.score.dispose();
    this.bus.clear();
  }

  private emit(outcome: EmissionOutcome): void {
    const holdSec = this.pressure.holdSec;
    this.pressure.vent(GAME_CONFIG.session.recoverySec);
    this.balance.resetPosition();

    if (outcome.kind === 'silent') {
      const detected = !this.options.tutorial && this.stealth.noticesSilent(this.professor.detectionChance());
      this.bus.emit('SILENT_EMISSION', {
        pressure: outcome.pressure, tier: outcome.tier.tier, perfect: outcome.perfect, detected, holdSec,
      });
      // En el tutorial siempre cae al menos uno: es la recompensa que enseña la mecánica.
      const tier = this.options.tutorial ? { ...outcome.tier, minTargets: Math.max(1, outcome.tier.minTargets) } : outcome.tier;
      const cloud = this.students.applyCloud(tier, this.rng, !detected);
      for (const id of cloud.drowsy) this.bus.emit('STUDENT_DROWSY', { studentId: id });
      for (const id of cloud.asleep) this.bus.emit('STUDENT_FELL_ASLEEP', { studentId: id });
      if (detected) this.strike('seen');
      if (!this.endReason && !this.options.tutorial && this.students.allAsleep) {
        this.bus.emit('CLASSROOM_CLEARED', {});
        this.end('cleared');
      }
      return;
    }

    this.bus.emit('TRUMPET_EMISSION', {
      pressure: outcome.pressure,
      variant: outcome.variant,
      intensity: outcome.intensity,
      forced: outcome.forced,
      duringSilence: this.professor.isSilent,
      holdSec,
    });
    for (const id of this.students.startle(outcome.intensity)) this.bus.emit('STUDENT_STARTLED', { studentId: id });
    if (!this.options.tutorial) this.strike('trumpet');
  }

  private strike(reason: 'trumpet' | 'seen'): void {
    const result = this.stealth.strike(reason);
    this.bus.emit('PROFESSOR_DETECTED_PLAYER', { reason, ...result });
    if (result.absorbed) return;
    this.professor.investigate(PLAYER_TARGET);
    if (result.strikes === GAME_CONFIG.session.maxStrikes - 1) this.professor.heighten();
    if (result.expelled) this.end('expelled');
  }

  private end(reason: EndReason): void {
    if (this.endReason) return;
    this.endReason = reason;
    this.holding = false;
    this.bus.emit('SESSION_ENDED', { reason });
  }
}

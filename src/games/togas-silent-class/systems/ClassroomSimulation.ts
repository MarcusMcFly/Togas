import { EventBus } from '../../../core/services/EventBus';
import { Random } from '../../../core/utils/Random';
import { BALANCE_CONFIG } from '../config/balance.config';
import { GAME_CONFIG } from '../config/game.config';
import type { PerkId } from '../config/perks.config';
import { REACTION_CONFIG } from '../config/reactions.config';
import { performanceTitle } from '../config/scoring.config';
import { STUDENT_SEATS, STUDENT_TIMINGS } from '../config/students.config';
import { BalanceSystem, type LevelStatus } from './BalanceSystem';
import { DifficultySystem, type DifficultyOutput } from './DifficultySystem';
import { resolveRelease, type EmissionOutcome } from './EmissionSystem';
import type { ClassroomEvents, EndReason } from './events';
import { PressureSystem } from './PressureSystem';
import { ProfessorAI } from './ProfessorAI';
import { ScoreSystem, type ClassroomStats } from './ScoreSystem';
import { StealthSystem } from './StealthSystem';
import { StudentReactionSystem, type EmissionReactions } from './StudentReactionSystem';

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

/**
 * Si soltar ahora sería silencioso, y si no, por qué. Es la ÚNICA fuente de verdad:
 * la usan `release()` y el HUD, así el verde nunca promete algo que la regla no cumple.
 */
export interface ReleaseReadiness {
  ready: boolean;
  blocked: 'ended' | 'notHolding' | 'tooShort' | 'recovering' | 'unbalanced' | null;
  /** 0–1 hacia los 350 ms de confirmación. */
  stability: number;
  /** Estado de cada nivel para el HUD. */
  horizontal: LevelStatus;
  vertical: LevelStatus;
}

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
  /** Azar solo cosmético (qué reacción sale): no altera la partida de una semilla. */
  private readonly flavorRng: Random;
  private emissionCount = 0;
  private current: DifficultyOutput;
  private holding = false;
  /** Duración del toque actual (para ignorar toques demasiado cortos). */
  private touchSec = 0;
  private readonly input = { x: 0, y: 0 };
  private elapsedSec = 0;
  private endReason: EndReason | null = null;

  constructor(private readonly options: SimulationOptions) {
    this.rng = new Random(options.seed);
    this.flavorRng = new Random((options.seed ^ 0x5eed1e55) >>> 0);
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

  get readiness(): ReleaseReadiness {
    const b = this.balance;
    let blocked: ReleaseReadiness['blocked'] = null;
    if (this.endReason) blocked = 'ended';
    else if (!this.holding) blocked = 'notHolding';
    else if (this.touchSec < GAME_CONFIG.session.minHoldSec) blocked = 'tooShort';
    else if (this.pressure.inRecovery) blocked = 'recovering';
    else if (!b.isStable) blocked = 'unbalanced';
    const ready = blocked === null;
    return {
      ready,
      blocked,
      stability: b.stability,
      horizontal: b.levelStatus(b.state.horizontal, ready),
      vertical: b.levelStatus(b.state.vertical, ready),
    };
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

  /**
   * Dedo arriba: intento de liberación. Se resuelve con el estado del último paso de
   * simulación, el mismo que ha dibujado el HUD: lo que se ve es lo que cuenta.
   */
  release(): ReleaseResult {
    const r = this.readiness;
    if (r.blocked === 'ended' || r.blocked === 'notHolding') return { kind: 'ignored' };
    this.holding = false;
    this.setInput(0, 0);
    if (r.blocked === 'tooShort' || r.blocked === 'recovering') {
      this.balance.releaseControl();
      return { kind: r.blocked };
    }
    if (this.options.tutorial && this.professor.attention !== 'away' && this.professor.attention !== 'aboutToTurn') {
      this.balance.releaseControl();
      return { kind: 'professorWatching' };
    }
    const outcome = resolveRelease({
      stable: r.ready,
      perfect: this.balance.isPerfect,
      pressure: this.pressure.value,
      forced: false,
    });
    this.emit(outcome);
    return { kind: 'emission', outcome };
  }

  /**
   * Un paso de partida, siempre en este orden (determinista):
   *  1. Las liberaciones llegan ANTES, entre pasos, y se resuelven con el estado anterior.
   *  2. Reloj: si se acaba, la clase termina aquí y no se simula nada más.
   *  3. Dificultad → equilibrio → presión (la emisión forzada va después del equilibrio).
   *  4. Profesor y compañeros.
   * Así una liberación válida antes del final nunca la pisa el timbre.
   */
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

  private byDistance(ids: readonly string[]): string[] {
    const distance = new Map(this.students.all.map((s) => [s.id, s.distance]));
    return [...ids].sort((a, b) => (distance.get(a) ?? 0) - (distance.get(b) ?? 0));
  }

  private publishReactions(reactions: EmissionReactions, kind: 'silent' | 'trumpet'): void {
    const emissionId = this.emissionCount;
    for (const r of reactions.students) this.bus.emit('STUDENT_REACTION', { emissionId, kind, ...r });
    if (reactions.headline) this.bus.emit('CLASS_REACTION', { emissionId, kind, ...reactions.headline });
  }

  private emit(outcome: EmissionOutcome): void {
    this.emissionCount++;
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
      this.publishReactions(this.students.react({
        kind: 'silent', pressure: outcome.pressure, perfect: outcome.perfect, reach: tier.reach,
        affected: this.byDistance([...cloud.asleep, ...cloud.drowsy]), asleep: cloud.asleep, trumpetIntensity: 0,
        rewarded: !detected || REACTION_CONFIG.bonusWhenDetected,
      }, this.flavorRng), 'silent');
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
    const startled = this.students.startle(outcome.intensity);
    for (const id of startled) this.bus.emit('STUDENT_STARTLED', { studentId: id });
    this.publishReactions(this.students.react({
      kind: 'trumpet', pressure: outcome.pressure, perfect: false,
      reach: STUDENT_TIMINGS.startleReachPerIntensity * (1 + outcome.intensity),
      affected: this.byDistance(startled), asleep: [], trumpetIntensity: outcome.intensity, rewarded: false,
    }, this.flavorRng), 'trumpet');
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

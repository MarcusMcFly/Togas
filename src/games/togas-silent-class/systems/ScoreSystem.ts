import type { EventBus } from '../../../core/services/EventBus';
import { SCORING, comboMultiplier } from '../config/scoring.config';
import type { ClassroomEvents, ScoreReason } from './events';

export interface ClassroomStats {
  score: number;
  studentsKnockedOut: number;
  silentFarts: number;
  trumpetFarts: number;
  perfectReleases: number;
  /** Presión más alta en una liberación silenciosa no detectada. */
  maxPressureSurvived: number;
  /** Ciclo más largo aguantando el gas (s). */
  longestHoldSec: number;
  /** Veces que el profe te ha pillado (avisos). */
  detections: number;
  bestStreak: number;
}

/**
 * Puntos, racha y estadísticas. Solo escucha eventos del aula: ningún sistema
 * le llama directamente, así se puede probar emitiendo eventos a mano.
 */
export class ScoreSystem {
  private stats: ClassroomStats = {
    score: 0, studentsKnockedOut: 0, silentFarts: 0, trumpetFarts: 0, perfectReleases: 0,
    maxPressureSurvived: 0, longestHoldSec: 0, detections: 0, bestStreak: 0,
  };
  private currentStreak = 0;
  private failures = 0;
  private readonly unsubscribers: Array<() => void>;

  constructor(private readonly bus: EventBus<ClassroomEvents>) {
    this.unsubscribers = [
      bus.on('SILENT_EMISSION', (e) => {
        this.stats.silentFarts++;
        this.stats.longestHoldSec = Math.max(this.stats.longestHoldSec, e.holdSec);
        // Si el profe lo nota, la penalización llega con PROFESSOR_DETECTED_PLAYER.
        if (e.detected) return;
        this.currentStreak++;
        this.failures = 0;
        this.stats.bestStreak = Math.max(this.stats.bestStreak, this.currentStreak);
        this.stats.maxPressureSurvived = Math.max(this.stats.maxPressureSurvived, Math.round(e.pressure));
        this.award(SCORING.quietRelease, 'quiet');
        if (e.perfect) {
          this.stats.perfectReleases++;
          this.award(SCORING.perfectRelease, 'perfect');
        }
        if (e.pressure >= SCORING.highPressureFrom) this.award(SCORING.highPressureRelease, 'highPressure');
        if (this.currentStreak % SCORING.streakBonusEvery === 0) this.award(SCORING.streakBonus, 'streak');
      }),
      bus.on('STUDENT_FELL_ASLEEP', () => {
        this.stats.studentsKnockedOut++;
        // El multiplicador solo afecta a los compañeros dormidos, no a bonus ni penalizaciones.
        this.award(Math.round(SCORING.studentAsleep * comboMultiplier(this.currentStreak)), 'student');
      }),
      bus.on('TRUMPET_EMISSION', (e) => {
        this.stats.trumpetFarts++;
        this.stats.longestHoldSec = Math.max(this.stats.longestHoldSec, e.holdSec);
        this.fail();
        this.award(SCORING.trumpetPenalty, 'trumpet');
      }),
      bus.on('PROFESSOR_DETECTED_PLAYER', (e) => {
        if (e.absorbed) return;
        this.stats.detections++;
        if (e.reason === 'seen') {
          this.fail();
          this.award(SCORING.detectionPenalty, 'detected');
        }
      }),
      bus.on('CLASSROOM_CLEARED', () => this.award(SCORING.classroomClear, 'clear')),
    ];
  }

  get score(): number {
    return this.stats.score;
  }

  /** Liberaciones silenciosas seguidas sin que te pillen. */
  get streak(): number {
    return this.currentStreak;
  }

  get multiplier(): number {
    return comboMultiplier(this.currentStreak);
  }

  /** Fallos seguidos (para la dificultad adaptativa). */
  get failuresInRow(): number {
    return this.failures;
  }

  snapshot(): ClassroomStats {
    return { ...this.stats };
  }

  dispose(): void {
    for (const off of this.unsubscribers) off();
  }

  private fail(): void {
    this.currentStreak = 0;
    this.failures++;
  }

  private award(points: number, reason: ScoreReason): void {
    const before = this.stats.score;
    // La puntuación nunca baja de cero.
    this.stats.score = Math.max(0, before + points);
    this.bus.emit('SCORE_AWARDED', { points: this.stats.score - before, reason });
  }
}

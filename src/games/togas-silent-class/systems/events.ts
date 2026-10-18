import type { AttentionLevel, ProfessorStateId, RandomEventKind } from '../config/professor.config';
import type { ReactionAnim } from '../config/reactions.config';
import type { TrumpetVariant } from '../config/scoring.config';

/**
 * Eventos del aula. Los sistemas publican lo que pasa y cada interesado (puntos,
 * estadísticas, audio, efectos, HUD) reacciona por su cuenta: nadie llama a nadie.
 */
export interface ClassroomEvents extends Record<string, unknown> {
  BALANCE_STABILIZED: Record<string, never>;
  BALANCE_LOST: Record<string, never>;
  GAS_PRESSURE_CRITICAL: { pressure: number };
  SILENT_EMISSION: {
    pressure: number;
    tier: number;
    perfect: boolean;
    /** El profe lo ha notado aunque haya sido silencioso. */
    detected: boolean;
    /** Segundos que se aguantó el gas en este ciclo. */
    holdSec: number;
  };
  TRUMPET_EMISSION: {
    pressure: number;
    variant: TrumpetVariant;
    intensity: number;
    /** Llegó a 100 sin soltar. */
    forced: boolean;
    /** Ocurrió durante el "Silencio inesperado". */
    duringSilence: boolean;
    holdSec: number;
  };
  STUDENT_DROWSY: { studentId: string };
  STUDENT_FELL_ASLEEP: { studentId: string };
  STUDENT_STARTLED: { studentId: string };
  /** Reacción de un compañero a una emisión (IMP-04). Como mucho una por compañero y emisión. */
  STUDENT_REACTION: {
    emissionId: number;
    kind: 'silent' | 'trumpet';
    studentId: string;
    reactionId: string;
    message: string;
    color: string;
    anim: ReactionAnim;
    intensity: number;
    bonus: number;
    distance: number;
  };
  /** Titular de toda la clase para una emisión ("¡Contaminación en el aula!"…). */
  CLASS_REACTION: { emissionId: number; kind: 'silent' | 'trumpet'; id: string; message: string; color: string; bonus: number };
  PROFESSOR_STATE: { state: ProfessorStateId; attention: AttentionLevel; targetSeatId: string | null };
  PROFESSOR_DETECTED_PLAYER: {
    reason: 'trumpet' | 'seen';
    strikes: number;
    /** La Silla Insonorizada se ha comido este aviso. */
    absorbed: boolean;
    expelled: boolean;
  };
  RANDOM_EVENT: { kind: RandomEventKind; seatId: string | null };
  SCORE_AWARDED: { points: number; reason: ScoreReason };
  CLASSROOM_CLEARED: Record<string, never>;
  SESSION_ENDED: { reason: EndReason };
}

export type ScoreReason =
  | 'student'
  | 'quiet'
  | 'perfect'
  | 'highPressure'
  | 'streak'
  | 'reaction'
  | 'clear'
  | 'trumpet'
  | 'detected';

export type EndReason = 'time' | 'expelled' | 'cleared';

import { GAME_CONFIG } from './game.config';

/** Caídas de la silla por desequilibrio crítico mantenido. */
export interface ChairRules {
  /** Segundos seguidos con una burbuja en zona crítica (apretando) antes de caer. */
  criticalSec: number;
  /** Caídas que suponen la expulsión. */
  maxFalls: number;
}

/**
 * Reglamento de la clase. El modo normal usa STANDALONE_CLASSROOM_RULES; la campaña
 * pasa el suyo sin tocar la lógica ni el modo normal.
 */
export interface ClassroomRules {
  id: string;
  /** Duración de la clase; `null` = sin límite (termina por objetivo o por fallo). */
  timeLimitSec: number | null;
  /**
   * `strikes`: avisos y expulsión al tercero (con detección probabilística).
   * `instantFail`: soltar con el profe mirando termina la partida al momento.
   */
  detection: 'strikes' | 'instantFail';
  /** Con `instantFail`, durante un giro cuenta como "mirando" a partir de esta orientación (0 = de espaldas, 1 = de frente). */
  lookingFrom: number;
  chair: ChairRules | null;
  /** `standard`: dormir a todos acaba la clase. `studentsThenProfessor`: después hay que derrotar al profe. */
  objective: 'standard' | 'studentsThenProfessor';
  /** El profe lleva detalles de aristócrata disfrazado (solo visual). */
  aristocrat: boolean;
}

export const STANDALONE_CLASSROOM_RULES: ClassroomRules = {
  id: 'standalone',
  timeLimitSec: GAME_CONFIG.session.durationSec,
  detection: 'strikes',
  lookingFrom: 0.5,
  chair: null,
  objective: 'standard',
  aristocrat: false,
};

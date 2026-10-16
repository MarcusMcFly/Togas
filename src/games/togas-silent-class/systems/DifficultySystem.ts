import { clamp } from '../../../core/utils/math';
import { ADAPTIVE, DIFFICULTY, GAME_CONFIG, type PhaseDifficulty, type PhaseId } from '../config/game.config';
import { PERK_EFFECTS, type PerkId } from '../config/perks.config';

export interface DifficultyInput {
  elapsedSec: number;
  failuresInRow: number;
  streak: number;
}

export interface DifficultyOutput extends PhaseDifficulty {
  phase: PhaseId;
}

/**
 * Fases de la sesión (0–25 s, 25–60 s, 60–90 s) + ajustes adaptativos acotados.
 * Nunca cambia los controles: solo deriva, ritmo de presión y comportamiento del profe.
 */
export class DifficultySystem {
  constructor(
    private readonly perk: PerkId | null,
    private readonly forgiving: boolean,
  ) {}

  static phaseAt(elapsedSec: number): PhaseId {
    let phase: PhaseId = GAME_CONFIG.phases[0].id;
    for (const p of GAME_CONFIG.phases) if (elapsedSec >= p.fromSec) phase = p.id;
    return phase;
  }

  /** Factor de deriva por fallos seguidos (1 = sin ayuda). */
  static driftRelief(failuresInRow: number): number {
    return clamp(1 - failuresInRow * ADAPTIVE.driftReliefPerFailure, ADAPTIVE.minDriftFactor, 1);
  }

  /** Factor de presión por rachas largas (1 = sin cambio). */
  static streakPressure(streak: number): number {
    const extra = Math.max(0, streak - ADAPTIVE.streakForPressure + 1);
    return clamp(1 + extra * ADAPTIVE.pressurePerExtraStreak, 1, ADAPTIVE.maxPressureFactor);
  }

  evaluate(input: DifficultyInput): DifficultyOutput {
    const phase = DifficultySystem.phaseAt(input.elapsedSec);
    const base = DIFFICULTY[phase];
    let drift = base.drift * DifficultySystem.driftRelief(input.failuresInRow);
    let pressureRate = base.pressureRate * DifficultySystem.streakPressure(input.streak);
    if (this.forgiving) {
      drift *= ADAPTIVE.forgiving.drift;
      pressureRate *= ADAPTIVE.forgiving.pressureRate;
    }
    if (this.perk === 'ironCheeks' && input.elapsedSec < PERK_EFFECTS.ironCheeks.durationSec) {
      drift *= PERK_EFFECTS.ironCheeks.driftFactor;
    }
    return { ...base, phase, drift, pressureRate };
  }
}

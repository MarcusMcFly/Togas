import type { CampaignEvent, ScoreChange } from '../../core/contracts/Mission';
import type { CampaignScoreState } from '../../core/progression/CampaignSave';

/** Qué puede pasarle a la puntuación en la misión actual. */
export interface ScoreRules {
  allowEarn: boolean;
  allowLose: boolean;
}

const MAX_SCORE = 10_000_000;
const LOCKED: ScoreRules = { allowEarn: false, allowLose: false };

/**
 * La ÚNICA puntuación de campaña. Los minijuegos solo informan de eventos; aquí se
 * decide si cuentan. Reglas que se cumplen siempre, no solo en la interfaz:
 * - Si la misión no permite ganar puntos, los eventos de ganancia se rechazan.
 * - La puntuación nunca baja de cero.
 * - Llegar a cero desde una puntuación positiva marca el intento como perdido (`depleted`).
 */
export class CampaignScoreSystem {
  private state: CampaignScoreState;
  private rules: ScoreRules = LOCKED;

  constructor(initial: CampaignScoreState = { currentScore: 0, totalEarned: 0, totalLost: 0 }) {
    this.state = { ...initial };
  }

  get score(): number {
    return this.state.currentScore;
  }

  get snapshot(): CampaignScoreState {
    return { ...this.state };
  }

  setRules(rules: ScoreRules): void {
    this.rules = rules;
  }

  /** Bloquea la puntuación (entre misiones nada puede cambiarla). */
  lock(): void {
    this.rules = LOCKED;
  }

  apply(event: CampaignEvent): ScoreChange {
    switch (event.type) {
      case 'CAMPAIGN_POINTS_EARNED':
        return this.earn(event.amount);
      case 'CAMPAIGN_POINTS_LOST':
        return this.lose(event.amount);
      default:
        return this.unchanged();
    }
  }

  private earn(amount: number): ScoreChange {
    const points = sanitize(amount);
    if (!this.rules.allowEarn || points === 0) return this.unchanged();
    const before = this.state.currentScore;
    this.state.currentScore = Math.min(MAX_SCORE, before + points);
    const applied = this.state.currentScore - before;
    this.state.totalEarned = Math.min(MAX_SCORE, this.state.totalEarned + applied);
    return { applied, score: this.state.currentScore, depleted: false };
  }

  private lose(amount: number): ScoreChange {
    const points = sanitize(amount);
    if (!this.rules.allowLose || points === 0) return this.unchanged();
    const before = this.state.currentScore;
    const loss = Math.min(points, before);
    this.state.currentScore = before - loss;
    this.state.totalLost = Math.min(MAX_SCORE, this.state.totalLost + loss);
    return { applied: -loss, score: this.state.currentScore, depleted: before > 0 && this.state.currentScore === 0 };
  }

  private unchanged(): ScoreChange {
    return { applied: 0, score: this.state.currentScore, depleted: false };
  }
}

/** Solo enteros positivos y finitos: cualquier otra cosa no cuenta. */
function sanitize(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(MAX_SCORE, Math.round(amount));
}

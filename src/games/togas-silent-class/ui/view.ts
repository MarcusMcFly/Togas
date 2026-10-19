import type { Expression } from '../art/seatedPlayer';
import type { AttentionLevel } from '../config/professor.config';
import type { JoystickView } from '../input/BalanceTouchController';
import type { LevelStatus } from '../systems/BalanceSystem';
import type { ReleaseReadiness } from '../systems/ClassroomSimulation';

/** Todo lo que el HUD lee en cada fotograma. Lo rellena ClassroomScene. */
export interface ClassroomView {
  mode: 'play' | 'tutorial';
  skinId: string;
  expression: Expression;
  score: number;
  timeLeft: number;
  streak: number;
  multiplier: number;
  asleep: number;
  totalStudents: number;
  strikesLeft: number;
  maxStrikes: number;
  pressure: number;
  horizontal: number;
  vertical: number;
  zoneH: LevelStatus;
  zoneV: LevelStatus;
  holding: boolean;
  /** Soltar ahora sería silencioso (misma comprobación que la liberación). */
  ready: boolean;
  blocked: ReleaseReadiness['blocked'];
  /** 0–1 hacia los 350 ms de confirmación. */
  stability: number;
  attention: AttentionLevel;
  attentionProgress: number;
  /** Aviso reforzado (perk "Apuntes del Profe"). */
  attentionEmphasis: boolean;
  silence: boolean;
  joystick: JoystickView;
  highContrast: boolean;
  /** Los indicadores aún no se muestran (intro del tutorial). */
  showLevels: boolean;
  /** Solo en misiones de campaña: caídas, objetivo actual, aviso de la silla y tiempo jugado. */
  campaign: { falls: number; maxFalls: number; professorTarget: boolean; tilt: number; elapsed: number } | null;
}
